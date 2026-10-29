require "test_helper"
class InvitationConcurrencyTest < ActiveSupport::TestCase
  self.use_transactional_tests = false
  test "two simultaneous acceptance attempts consume a staff invitation exactly once" do
    password=SecureRandom.base64(24)
    owner=Platform::Administrator.create!(email:"super-#{SecureRandom.hex(8)}@example.invalid",password:password,role:"super_admin")
    account=Platform::Administrator.create!(email:"pending-#{SecureRandom.hex(8)}@example.invalid",password:SecureRandom.base64(24),role:"admin",enabled:false)
    record=Platform::Invitations.issue!(actor:owner,kind:"staff",email:account.email,administrator:account)
    raw=record.issued_token
    ready=Queue.new;start=Queue.new;results=Queue.new
    workers=2.times.map do
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          ready << true;start.pop
          begin
            results << Platform::Invitations.accept!(token:raw,password:password,confirmation:password,name:"Synthetic recipient")
          rescue TenantManagement::Error => error
            results << error.code
          end
        end
      end
    end
    2.times{ready.pop};2.times{start<<true};workers.each(&:join)
    assert_equal ["invitation_already_used","staff"],2.times.map{results.pop}.sort
    assert account.reload.enabled?
    assert record.reload.accepted_at
    assert_equal 1,Platform::AccountEvent.where(subject_id:record.id,action:"invitation_accepted").count
  ensure
    workers&.each{|worker|worker.kill if worker.alive?}
    Platform::AccountEvent.where(subject_id:record.id).delete_all if record
    Platform::Invitation.where(id:record.id).delete_all if record
    Platform::Administrator.where(id:[account&.id,owner&.id].compact).delete_all
  end
end
