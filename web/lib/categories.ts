import { CloudRain, Plane, Sprout, Ship, Ticket } from 'lucide-react';

export const categories = [
  { id: 'weather', name: 'Weather', icon: CloudRain, available: true, accent: '#286785', title: 'Weather, with defined terms.', description: 'Rainfall protection tied to a committed observation window and an inspectable ERA5 snapshot.', subject: 'Rainfall · Environmental risk' },
  { id: 'travel', name: 'Travel', icon: Plane, available: false, accent: '#3F5E96', title: 'A clearer route through disruption.', description: 'A future category for flight and journey disruption. Protection contracts and markets are not yet implemented.', subject: 'Aviation · Journey disruption' },
  { id: 'agriculture', name: 'Agriculture', icon: Sprout, available: false, accent: '#557743', title: 'Risk at the scale of a season.', description: 'A future category for crop and environmental risk. Protection contracts and markets are not yet implemented.', subject: 'Crop conditions · Seasonal exposure' },
  { id: 'logistics', name: 'Logistics', icon: Ship, available: false, accent: '#367875', title: 'Keep uncertainty in view.', description: 'A future category for shipping and supply-chain disruption. Protection contracts and markets are not yet implemented.', subject: 'Shipping · Supply-chain disruption' },
  { id: 'events', name: 'Events', icon: Ticket, available: false, accent: '#835C84', title: 'Behind every gathering, a plan.', description: 'A future category for venue and operational risk. Protection contracts and markets are not yet implemented.', subject: 'Venues · Operational risk' },
] as const;
export type CategoryId = (typeof categories)[number]['id'];

// Presentation rules for future verified datasets. No synthetic series are supplied.
export const categoryDataStyles: Record<CategoryId, {shape:string; unit:string; accent:string}> = {
  weather: {shape:'Rainfall columns with a threshold rule',unit:'mm',accent:'#286785'},
  travel: {shape:'Route diagram and departure timeline',unit:'minutes',accent:'#3F5E96'},
  agriculture: {shape:'Field tiles and vegetation-index bands',unit:'Source-defined vegetation index',accent:'#557743'},
  logistics: {shape:'Shipping network and transit timeline',unit:'hours',accent:'#367875'},
  events: {shape:'Venue plan and operational timeline',unit:'Source-defined operational measure',accent:'#835C84'},
};
