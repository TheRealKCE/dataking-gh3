-- Add agent_price column to data_packages table if it doesn't exist
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name = 'data_packages' and column_name = 'agent_price') then
    alter table data_packages add column agent_price numeric default 0;
  end if;
end $$;
