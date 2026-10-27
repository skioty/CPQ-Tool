module TenantManagement
  class ReferenceOption < ApplicationRecord
    self.table_name = "public.platform_reference_options"
    validates :kind, inclusion: { in: %w[industry currency payment_method] }
    validates :code, :label, presence: true
    validates :code, uniqueness: { scope: :kind }
    before_validation { self.label = label.strip if label.is_a?(String) }
    validates :label, length:{maximum:120}, uniqueness:{scope: :kind,case_sensitive:false}, if: -> {kind == "industry"}
    before_destroy { throw :abort }
    def self.seed_defaults!
      transaction do
        { "industry" => [["raw_materials","Raw Materials"],["services","Services"],["manufacturing","Manufacturing"]], "currency" => %w[BTN INR USD EUR].map { |v| [v, v] },
          "payment_method" => [["bank_transfer", "Bank Transfer"], ["other", "Other"]] }.each do |kind, values|
          values.each do |code,label|
            next if kind == "industry" && where(kind:kind).exists?(["lower(btrim(label)) = ?",label.downcase])
            find_or_create_by!(kind: kind, code: code) { |r| r.label = label }
          end
        end
      end
    end
  end
end
