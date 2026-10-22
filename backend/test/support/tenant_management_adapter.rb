# Synthetic integration collaborator ONLY loaded by tests. Not Devise/Apartment proof.
class TenantManagementTestAdapter < TenantManagement::Integration
  Actor = Struct.new(:id)
  attr_accessor :actor, :visible_ids, :denied_actions, :reject_admins, :provision_failure,
    :compensation_failure, :business_failure, :asset_failure
  attr_reader :compensated, :provisioned

  def initialize
    @actor = Actor.new("test-super-admin")
    @visible_ids, @denied_actions = nil, []
    @compensated, @provisioned = [], []
  end

  def authenticate!(_controller) = actor
  def scope!(_actor)
    visible_ids ? TenantManagement::Tenant.where(id: visible_ids) : TenantManagement::Tenant.all
  end
  def authorize!(_actor, action, _tenant = nil)
    raise TenantManagement::Error.new("forbidden", "Action is not permitted", status: 403) if denied_actions.include?(action)
    true
  end
  def validate_business!(_actor, _attributes, _tenant)
    raise TenantManagement::Error.new("validation_failed", "Review the highlighted fields", fields: { company_name: ["Synthetic required field"] }) if business_failure
    true
  end
  def validate_assignments!(_actor, ids, _tenant)
    if reject_admins || ids.include?("ineligible")
      raise TenantManagement::Error.new("validation_failed", "Review the highlighted fields", fields: { responsible_admin_ids: ["Administrator is not eligible"] })
    end
    true
  end
  def validate_assets!(_actor, _ids, _tenant)
    raise TenantManagement::Error.new("validation_failed", "Assets are not authorized", fields: { branding: ["Asset unavailable"] }) if asset_failure
    true
  end
  def initial_lifecycle! = nil
  def filter_status!(value)
    raise TenantManagement::Error.new("invalid_filter", "Status has not been approved", status: 400) unless value == "test-state"
    true
  end
  def provision!(tenant)
    raise TenantManagement::Error.new("provisioning_failed", "Provisioning failed", status: 503) if provision_failure
    @provisioned << tenant.id
    { tenant_id: tenant.id }
  end
  def compensate!(receipt)
    raise "synthetic cleanup failure" if compensation_failure
    @compensated << receipt
    true
  end
end
