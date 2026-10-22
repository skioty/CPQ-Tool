ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
# Match Rails' normal test setting for API controllers including the CSRF module.
# Security tests explicitly turn this on and exercise missing/valid/stale tokens.
ApplicationController.allow_forgery_protection = false

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # Add more helper methods to be used by all tests here...
  end
end
