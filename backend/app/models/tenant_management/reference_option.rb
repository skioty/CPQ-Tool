module TenantManagement
  class ReferenceOption < ApplicationRecord
    self.table_name = "public.platform_reference_options"
    validates :kind, inclusion: { in: %w[industry currency payment_method] }
    validates :code, :label, presence: true
    validates :code, uniqueness: { scope: :kind }
    before_destroy { throw :abort }
    def self.seed_defaults!
      transaction do
        { "currency" => %w[BTN INR USD EUR].map { |v| [v, v] },
          "payment_method" => [["bank_transfer", "Bank Transfer"], ["other", "Other"]] }.each do |kind, values|
          values.each { |code, label| find_or_create_by!(kind: kind, code: code) { |r| r.label = label } }
        end
      end
    end
  end
end
