module Platform
  class SessionsController < ApplicationController
    def csrf
      render json: { csrf_token: form_authenticity_token }
    end

    def create
      credentials = params.require(:administrator).permit(:email, :password)
      unless credentials[:email].is_a?(String) && credentials[:password].is_a?(String)
        return render json: { error: { code: "invalid_credentials", message: "Invalid email or password", fields: {} } }, status: 401
      end
      request.env["warden"].logout(:administrator)
      # Devise's database strategy performs constant-cost dummy hashing on an unknown login.
      request.env["devise.allow_params_authentication"] = true
      account = request.env["warden"].authenticate(scope: :administrator, store: false)
      unless account && account.active_for_authentication?
        return render json: { error: { code: "invalid_credentials", message: "Invalid email or password", fields: {} } }, status: 401
      end
      if Platform::AccountSecurity.enforced?
        return render json: Platform::AccountSecurity.begin!(self, "administrator", account), status: :accepted
      end
      reset_session
      sign_in(:administrator, account, force: true)
      render json: { data: identity(account), csrf_token: form_authenticity_token }
    end

    def show
      account = current_administrator
      return unauthorized unless account&.enabled?
      render json: { data: identity(account) }
    end

    def destroy
      sign_out(:administrator)
      reset_session
      head :no_content
    end

    private

    def identity(account) = { id: account.id, role: account.role }
    def unauthorized
      render json: { error: { code: "unauthenticated", message: "Administrator login is required", fields: {} } }, status: 401
    end
  end
end
