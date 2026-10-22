Rails.application.routes.draw do
  devise_for :administrators, class_name: "Platform::Administrator", skip: :all
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
      resources :tenants, only: [:index, :show, :create, :update] do
        post :lifecycle, on: :member
      end
    end
  end

  # Defines the root path route ("/")
  # root "posts#index"
end
