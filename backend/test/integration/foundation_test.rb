require "test_helper"

class FoundationTest < ActionDispatch::IntegrationTest
  test "application health route responds successfully" do
    get "/up"
    assert_response :success
  end

  test "test database accepts a PostgreSQL query" do
    assert_equal "PostgreSQL", ActiveRecord::Base.connection.adapter_name
    assert_equal 1, ActiveRecord::Base.connection.select_value("SELECT 1")
    base = Regexp.escape(ENV.fetch("TEST_DATABASE_NAME", "cpq_test"))
    # Rails creates numbered databases when the suite crosses its parallel threshold.
    assert_match /\A#{base}(?:_\d+)?\z/,
      ActiveRecord::Base.connection.select_value("SELECT current_database()")
  end
end
