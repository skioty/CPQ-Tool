require "net/http"
module TenantManagement
  class ExchangeRateBook < ApplicationRecord
    self.table_name = "public.platform_exchange_rate_books"
    SOURCE = "https://www.exchangerate-api.com"
    ENDPOINT = URI("https://open.er-api.com/v6/latest/USD")
    MAX_AGE = 48.hours
    def self.current! = find_or_create_by!(id: 1)
    def usable? = rate_time.present? && rate_time >= MAX_AGE.ago && rate_time <= 1.hour.from_now && rates["USD"].to_s == "1"

    # Public rate retrieval sends no tenant, contact, account or commercial data.
    # Called by quote requests/tasks, never by tenant persistence.
    def self.refresh_if_needed!
      record = current!
      return record if record.usable? && record.fetched_at && record.fetched_at > 24.hours.ago
      record.with_lock do
        return record if record.usable? && record.fetched_at && record.fetched_at > 24.hours.ago
        return record if record.last_attempt_at && record.last_attempt_at > 1.hour.ago
        record.update!(last_attempt_at: Time.current)
        begin
          response = Net::HTTP.start(ENDPOINT.host, ENDPOINT.port, use_ssl: true, open_timeout: 3, read_timeout: 5) { |http| http.get(ENDPOINT.request_uri) }
          raise "Rate provider unavailable" unless response.is_a?(Net::HTTPSuccess) && response.body.bytesize < 200_000
          data = JSON.parse(response.body)
          rates = data["rates"]
          unless data["result"] == "success" && data["base_code"] == "USD" && rates.is_a?(Hash) && rates["USD"].to_s == "1" &&
              rates.all? { |code,value| code.match?(/\A[A-Z]{3}\z/) && value.to_s.match?(/\A\d+(?:\.\d+)?\z/) && BigDecimal(value.to_s) > 0 }
            raise "Invalid rate response"
          end
          rate_time = Time.at(Integer(data.fetch("time_last_update_unix"))).utc
          raise "Outdated rate response" unless rate_time >= MAX_AGE.ago && rate_time <= 1.hour.from_now
          record.update!(rates: rates.transform_values(&:to_s), rate_time: rate_time, fetched_at: Time.current)
        rescue StandardError => e
          Rails.logger.warn("Exchange rate refresh unavailable error_class=#{e.class.name}")
        end
      end
      record
    end

    def self.convert!(amount, from:, to:)
      unless amount.to_s.match?(/\A\d+(?:\.\d{1,2})?\z/) && BigDecimal(amount.to_s) <= BigDecimal("999999999.99")
        raise Error.new("validation_failed", "Use a nonnegative amount with up to two decimals")
      end
      return {fee: BigDecimal(amount.to_s).to_s("F"), source_fee: amount.to_s, source_currency: from, currency: to, converted: false} if from == to
      record = current!
      record.lock!("FOR SHARE") if connection.transaction_open?
      unless record.usable? && record.rates[from] && record.rates[to]
        raise Error.new("exchange_rate_unavailable", "A current exchange rate is unavailable for #{from} to #{to}. Refresh pricing or use an agreed Custom fee.", status: 422, fields: {"subscription.currency" => ["Current conversion rate unavailable"]})
      end
      rate = BigDecimal(record.rates.fetch(to)) / BigDecimal(record.rates.fetch(from))
      fee = (BigDecimal(amount.to_s) * rate).round(2, BigDecimal::ROUND_HALF_UP)
      raise Error.new("validation_failed", "Converted fee exceeds the supported limit") if fee > BigDecimal("999999999.99")
      {fee: format("%.2f", fee), source_fee: amount.to_s, source_currency: from, currency: to,
       converted: true, rate: rate.to_s("F"), rate_time: record.rate_time.iso8601, provider: SOURCE}
    end
  end
end
