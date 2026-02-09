-- Enable realtime for live shop tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_carts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_cart_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_waitlist;