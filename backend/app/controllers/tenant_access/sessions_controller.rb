module TenantAccess
  class SessionsController < ApplicationController
    def create
      credentials = params.require(:tenant_user).permit(:email, :password)
      unless credentials[:email].is_a?(String) && credentials[:password].is_a?(String)
        return render json: {error: {code: "invalid_credentials", message: "Invalid email or password", fields: {}}}, status: 401
      end
      request.env["warden"].logout(:tenant_user)
      request.env["devise.allow_params_authentication"] = true
      account = request.env["warden"].authenticate(scope: :tenant_user, store: false)
      unless account && account.active_for_authentication?
        return render json: {error: {code: "invalid_credentials", message: "Invalid email or password", fields: {}}}, status: 401
      end
      reset_session
      sign_in(:tenant_user, account, force: true)
      render json: {data: {id: account.id, email: account.email}, csrf_token: form_authenticity_token}
    end
    def show
      return render json: {error: {code: "unauthenticated", message: "Tenant sign-in is required", fields: {}}}, status: 401 unless current_tenant_user&.enabled?
      render json: {data: {id: current_tenant_user.id, email: current_tenant_user.email}}
    end
    def destroy
      sign_out(:tenant_user)
      reset_session
      head :no_content
    end
  end
end
