alter table campaign_links
  drop constraint if exists campaign_links_channel_check;

alter table campaign_links
  add constraint campaign_links_channel_check
  check (channel in ('whatsapp', 'facebook', 'instagram', 'portal', 'direct'));
