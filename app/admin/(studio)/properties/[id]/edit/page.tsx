'use client';
import { useParams } from 'next/navigation';
import { PropertyForm } from '@/components/admin/PropertyForm';
export default function EditPropertyPage() {
  const params = useParams<{ id: string }>();
  return <PropertyForm propertyId={params.id} />;
}
