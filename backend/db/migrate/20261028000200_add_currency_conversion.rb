class AddCurrencyConversion < ActiveRecord::Migration[8.1]
  def up
    add_column "public.platform_tenant_subscriptions", :pricing_conversion, :jsonb
    create_table "public.platform_exchange_rate_books" do |t|
      t.jsonb :rates, null: false, default: {}
      t.datetime :rate_time
      t.datetime :fetched_at
      t.datetime :last_attempt_at
      t.timestamps
    end
    add_check_constraint "public.platform_exchange_rate_books", "id = 1", name: "single_exchange_rate_book"
    # Versioned CLDR 49 current-tender currency catalogue; do not re-enable disabled options.
    %w[AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XCG XOF XPF YER ZAR ZMW ZWG].each do |code|
      execute "INSERT INTO public.platform_reference_options (id,kind,code,label,enabled,created_at,updated_at) VALUES (gen_random_uuid(),'currency',#{quote(code)},#{quote(code)},true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT (kind,code) DO NOTHING"
    end
  end
  def down
    remove_column "public.platform_tenant_subscriptions", :pricing_conversion
    drop_table "public.platform_exchange_rate_books"
    # Retain currency catalogue entries: tenants may now reference them.
  end
end
