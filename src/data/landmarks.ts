export interface Landmark {
  id: string;
  name: string;
  lng: number;
  lat: number;
  icon: string;
}

export const LANDMARKS: Landmark[] = [
  { id: 'bangalore-palace', name: 'Bangalore Palace', lng: 77.5920, lat: 12.9987, icon: '🏰' },
  { id: 'vidhana-soudha', name: 'Vidhana Soudha', lng: 77.5906, lat: 12.9796, icon: '🏛️' },
  { id: 'ulsoor-lake', name: 'Ulsoor Lake', lng: 77.6192, lat: 12.9815, icon: '🌊' },
  { id: 'church-street', name: 'Church Street', lng: 77.6048, lat: 12.9750, icon: '⛪' },
  { id: 'cubbon-park', name: 'Cubbon Park', lng: 77.5933, lat: 12.9750, icon: '🌳' },
  { id: 'indiranagar', name: 'Indiranagar', lng: 77.6409, lat: 12.9716, icon: '🛍️' },
  { id: 'lalbagh', name: 'Lalbagh', lng: 77.5900, lat: 12.9500, icon: '🌷' },
  { id: 'mg-road', name: 'MG Road', lng: 77.6119, lat: 12.9738, icon: '🛣️' },
  { id: 'koramangala', name: 'Koramangala', lng: 77.6112, lat: 12.9346, icon: '☕' },
  { id: 'commercial-street', name: 'Commercial Street', lng: 77.6084, lat: 12.9822, icon: '🛒' },
  { id: 'the-spark-whitefield', name: 'the*spark, Whitefield', lng: 77.72065, lat: 12.99116, icon: '🏢' },
];

export function landmarkById(id: string): Landmark | undefined {
  return LANDMARKS.find((l) => l.id === id);
}
