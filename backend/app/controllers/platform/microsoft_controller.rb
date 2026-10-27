module Platform
  class MicrosoftController < ApplicationController
    rescue_from TenantManagement::Error do |error|
      render json:{error:{code:error.code,message:error.message,fields:error.fields}},status:error.status
    end
    def status
      render json:{data:{configured:MicrosoftIdentity.configured?}}
    end
    def start
      flow,url = MicrosoftIdentity.start!(scope:params[:account_scope].to_s)
      sign_out(:administrator);sign_out(:tenant_user);reset_session
      session[:microsoft_flow] = flow
      render json:{authorization_url:url,csrf_token:form_authenticity_token}
    end
    def link
      scope,account = current_administrator ? ["administrator",current_administrator] : ["tenant_user",current_tenant_user]
      unless account&.active_for_authentication? && params[:password].is_a?(String) && account.valid_password?(params[:password])
        raise TenantManagement::Error.new("invalid_credentials","Verify your current account password before linking",status:401)
      end
      flow,url = MicrosoftIdentity.start!(scope:scope,account_id:account.id)
      session[:microsoft_flow] = flow
      render json:{authorization_url:url}
    end
    def callback
      flow = session.delete(:microsoft_flow)
      claims = MicrosoftIdentity.consume!(flow,params[:state],params[:code])
      if flow["account_id"]
        klass = flow["scope"] == "administrator" ? Administrator : TenantAccess::User
        account = klass.find(flow["account_id"])
        raise TenantManagement::Error.new("forbidden","This account is disabled",status:403) unless account.active_for_authentication?
        ExternalIdentity.create!(issuer:MicrosoftIdentity.issuer,subject:claims.fetch("sub"),account_scope:flow["scope"],account_id:account.id,created_at:Time.current)
        AccountEvent.create!(actor_id:account.id,subject_id:account.id,action:"microsoft_identity_linked",created_at:Time.current)
        redirect_to "/security/account?linked=1", status: :see_other
      else
        identity = ExternalIdentity.find_by(issuer:MicrosoftIdentity.issuer,subject:claims.fetch("sub"),account_scope:flow["scope"])
        raise TenantManagement::Error.new("forbidden","This Microsoft identity is not linked to an invited account. Sign in with your password first.",status:403) unless identity
        AccountSecurity.account({"scope"=>identity.account_scope,"id"=>identity.account_id,"started"=>Time.current.to_i})
        AccountSecurity.begin!(self,identity.account_scope,identity.account)
        redirect_to "/security/verify",status: :see_other
      end
    rescue ActiveRecord::RecordNotUnique
      render json:{error:{code:"identity_conflict",message:"This Microsoft identity or account is already linked.",fields:{}}},status:409
    rescue StandardError => error
      Rails.logger.warn("Microsoft callback failed error_class=#{error.class.name}")
      redirect_to "/security/identity-error",status: :see_other
    end
  end
end
