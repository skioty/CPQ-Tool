module Platform
  class FactorsController < ApplicationController
    rescue_from TenantManagement::Error do |error|
      render json:{error:{code:error.code,message:error.message,fields:error.fields}},status:error.status
    end
    def show
      pending = session[:pending_factor] || {}
      account = AccountSecurity.account(pending)
      enrolling = account.totp_secret_ciphertext.blank?
      render json:{data:{enrollment:enrolling, email:account.email, setup_key:enrolling ? pending["secret"] : nil, account_scope:pending["scope"]}}
    end
    def create
      pending = session[:pending_factor] || {}
      account = AccountSecurity.account(pending)
      result = AccountSecurity.confirm!(account,pending,params[:code])
      unless result[:valid]
        return render json:{error:{code:"invalid_factor",message:"The code is invalid or has already been used. Try the next authenticator code or a recovery code.",fields:{}}},status:422
      end
      reset_session
      sign_in(pending["scope"].to_sym, account,force:true)
      session[:mfa_verified_for] = "#{pending['scope']}:#{account.id}"
      render json:{data:{account_scope:pending["scope"]},recovery_codes:result[:recovery_codes],csrf_token:form_authenticity_token}
    end
    def destroy
      sign_out(:administrator); sign_out(:tenant_user); reset_session
      head :no_content
    end
  end
end
