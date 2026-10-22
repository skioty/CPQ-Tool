require "test_helper"
require_relative "../support/tenant_management_adapter"
require "timeout"

class TenantManagementIntegrityTest < ActiveSupport::TestCase
  self.use_transactional_tests = false

  setup do
    @ids = []
    @adapter = TenantManagementTestAdapter.new
    @actor = @adapter.actor
  end

  teardown do
    # Only synthetic records created by this class. No development/production data.
    TenantManagement::Tenant.transaction do
      TenantManagement::Tenant.connection.execute("SET CONSTRAINTS ALL DEFERRED")
      [TenantManagement::AuditEvent, TenantManagement::Assignment, TenantManagement::Subscription,
        TenantManagement::Branding, TenantManagement::Contact].each { |model| model.where(tenant_id: @ids).delete_all }
      TenantManagement::Tenant.where(id: @ids).delete_all
    end
  end

  def writer(adapter = @adapter)
    TenantManagement::Writer.new(integration: adapter, actor: @actor, request_id: "integrity-test")
  end

  def attributes
    TenantManagement::Payload.parse({ "company_name" => "Integrity test", "contacts" => [{ "primary" => true }] })
  end

  def tenant
    record = writer.create(attributes)
    @ids << record.id
    record
  end

  test "database rejects a tenant committed without a primary contact" do
    before = TenantManagement::Tenant.count
    assert_raises(ActiveRecord::StatementInvalid) do
      TenantManagement::Tenant.transaction do
        TenantManagement::Tenant.create!(company_name: "No primary")
      end
    end
    assert_equal before, TenantManagement::Tenant.count
  end

  test "direct database removal or demotion of primary is rejected at commit" do
    record = tenant
    contact = record.contacts.sole
    assert_raises(ActiveRecord::StatementInvalid) do
      TenantManagement::Contact.transaction { contact.update_columns(primary: false) }
    end
    assert contact.reload.primary
    assert_raises(ActiveRecord::StatementInvalid) do
      TenantManagement::Contact.transaction { contact.delete }
    end
    assert_equal 1, record.contacts.reload.count
  end

  test "partial unique index rejects two primaries and contact ownership cannot change" do
    first = tenant
    second = tenant
    assert_raises(ActiveRecord::RecordNotUnique) do
      first.contacts.create!(primary: true)
    end
    assert_raises(ActiveRecord::StatementInvalid) do
      first.contacts.sole.update_columns(tenant_id: second.id)
    end
    assert_equal first.id, first.contacts.reload.sole.tenant_id
  end

  test "concurrent updates serialize and reject the stale request" do
    record = tenant
    expected = record.lock_version
    start = Queue.new
    results = Queue.new
    threads = 2.times.map do |index|
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          start.pop
          begin
            writer.update(TenantManagement::Tenant.find(record.id), { "description" => "Writer #{index}" }, expected_version: expected)
            results << :saved
          rescue TenantManagement::Error => error
            results << error.code
          rescue StandardError => error
            results << error
          end
        end
      end
    end
    2.times { start << true }
    Timeout.timeout(15) { threads.each(&:join) }
    outcomes = 2.times.map { results.pop }
    assert_equal 1, outcomes.count(:saved), outcomes.inspect
    assert_equal 1, outcomes.count("stale_version"), outcomes.inspect
    assert_equal 1, record.contacts.reload.where(primary: true).count
    assert_equal 2, record.audit_events.count
  end

  test "post-provision transaction failure compensates and leaves no registry record" do
    failing_writer = Class.new(TenantManagement::Writer) do
      private
      def audit!(*args)
        raise TenantManagement::Error.new("synthetic_failure", "Synthetic persistence failure", status: 503)
      end
    end.new(integration: @adapter, actor: @actor, request_id: "compensation-test")
    assert_no_difference "TenantManagement::Tenant.count" do
      assert_raises(TenantManagement::Error) { failing_writer.create(attributes) }
    end
    assert_equal @adapter.provisioned, @adapter.compensated.map { |receipt| receipt[:tenant_id] }
  end

  test "failed compensation is explicit and never reports successful creation" do
    @adapter.compensation_failure = true
    failing_writer = Class.new(TenantManagement::Writer) do
      private
      def audit!(*args)
        raise "synthetic failure"
      end
    end.new(integration: @adapter, actor: @actor, request_id: "recovery-test")
    error = assert_raises(TenantManagement::Error) { failing_writer.create(attributes) }
    assert_equal "provisioning_recovery_required", error.code
    assert_equal 503, error.status
    assert_not TenantManagement::Tenant.exists?(@adapter.provisioned.last)
  end

  test "false business approval cannot silently enable writes" do
    def @adapter.validate_business!(*args) = false
    assert_no_difference "TenantManagement::Tenant.count" do
      error = assert_raises(TenantManagement::Error) { writer.create(attributes) }
      assert_equal "integration_unavailable", error.code
    end
  end

  test "public-qualified records stay in public under another schema search path" do
    record = tenant
    ActiveRecord::Base.connection_pool.with_connection do |connection|
      previous = connection.schema_search_path
      begin
        connection.schema_search_path = "pg_catalog,public"
        assert_equal record.id, TenantManagement::Tenant.find(record.id).id
        assert_equal "public.platform_tenants", TenantManagement::Tenant.table_name
      ensure
        connection.schema_search_path = previous
      end
    end
  end
end
