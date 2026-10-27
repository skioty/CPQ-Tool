Rails.application.routes.draw do
  get "api/v1/microsoft/status", to: "platform/microsoft#status"
  post "api/v1/microsoft/start", to: "platform/microsoft#start"
  post "api/v1/microsoft/link", to: "platform/microsoft#link"
  get "api/v1/microsoft/callback", to: "platform/microsoft#callback"
  get "api/v1/tenants/:tenant_id/retention", to: "platform/retention#show"
  patch "api/v1/tenants/:tenant_id/retention", to: "platform/retention#update"
  delete "api/v1/tenants/:tenant_id/permanent_deletion", to: "platform/retention#destroy"
  get "api/v1/factor", to: "platform/factors#show"
  post "api/v1/factor", to: "platform/factors#create"
  delete "api/v1/factor", to: "platform/factors#destroy"
  devise_for :administrators, class_name: "Platform::Administrator", skip: :all
  devise_for :tenant_users, class_name: "TenantAccess::User", skip: :all
  devise_scope :tenant_user do
    get "api/v1/tenant_session", to: "tenant_access/sessions#show"
    post "api/v1/tenant_session", to: "tenant_access/sessions#create"
    delete "api/v1/tenant_session", to: "tenant_access/sessions#destroy"
  end
  get "api/v1/my_workspaces", to: "tenant_access/workspaces#index"
  get "api/v1/my_workspaces/:id", to: "tenant_access/workspaces#show"
  get "api/v1/my_workspaces/:id/assets/:asset_id", to: "tenant_access/workspaces#asset"
  get "api/v1/administrators", to: "platform/administrators#index"
  post "api/v1/administrators", to: "platform/administrators#create"
  post "api/v1/administrators/:id/invite", to: "platform/administrators#invite"
  patch "api/v1/administrators/:id", to: "platform/administrators#update"
  get "api/v1/tenants/:tenant_id/invitations", to: "platform/invitations#index"
  post "api/v1/tenants/:tenant_id/invitations", to: "platform/invitations#create"
  post "api/v1/invitations/:id/resend", to: "platform/invitations#resend"
  post "api/v1/invitations/:id/revoke", to: "platform/invitations#revoke"
  post "api/v1/invitation_preview", to: "platform/invitation_acceptances#preview"
  post "api/v1/invitation_acceptance", to: "platform/invitation_acceptances#create"
  devise_scope :administrator do
    get "api/v1/session/csrf", to: "platform/sessions#csrf"
    get "api/v1/session", to: "platform/sessions#show"
    post "api/v1/session", to: "platform/sessions#create"
    delete "api/v1/session", to: "platform/sessions#destroy"
  end
  if Rails.env.test?
    get "api/v1/tenants/:id/isolation-probe", to: "platform/isolation_probes#show"
  end
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check
  namespace :api do
    namespace :v1 do
      resources :reference_options, only: [:index, :create, :update, :destroy]
      resources :brand_assets, only: [:create, :show]
      resources :tenants, only: [:index, :show, :create, :update] do
        post :lifecycle, on: :member
        get :activity, on: :member
        get :setup_review, on: :member
      end
    end
  end

  # Defines the root path route ("/")
  # root "posts#index"
end
