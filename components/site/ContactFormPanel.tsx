'use client';
import { InquiryForm } from './InquiryForm';
import { useSiteSettings } from '@/lib/hooks/useSiteData';
export function ContactFormPanel() {
  const { settings } = useSiteSettings();
  return <InquiryForm settings={settings} heading="Send a private enquiry" />;
}
