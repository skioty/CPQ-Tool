require "test_helper"
class ExchangeRateBookTest < ActiveSupport::TestCase
  setup do
    @book = TenantManagement::ExchangeRateBook.current!
    @book.update!(rates: {"USD"=>"1","BTN"=>"90","INR"=>"90","EUR"=>"0.9"}, rate_time: Time.current, fetched_at: Time.current)
  end
  test "converts with decimal arithmetic and refuses stale or unsupported rates" do
    quote=TenantManagement::ExchangeRateBook.convert!("4500.00",from:"BTN",to:"USD")
    assert_equal "50.00",quote[:fee]
    assert_equal "BTN",quote[:source_currency]
    assert_equal "4500.00",TenantManagement::ExchangeRateBook.convert!("4500",from:"BTN",to:"INR")[:fee]
    assert_equal "45.00",TenantManagement::ExchangeRateBook.convert!("4500",from:"BTN",to:"EUR")[:fee]
    assert_raises(TenantManagement::Error){TenantManagement::ExchangeRateBook.convert!("1",from:"BTN",to:"GBP")}
    @book.update!(rate_time:3.days.ago)
    assert_raises(TenantManagement::Error){TenantManagement::ExchangeRateBook.convert!("4500",from:"BTN",to:"USD")}
    assert_equal "4500.0",TenantManagement::ExchangeRateBook.convert!("4500",from:"BTN",to:"BTN")[:fee]
  end
end
