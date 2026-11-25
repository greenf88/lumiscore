/** Fixed editorial destinations; never derive measurement dimensions from arbitrary URLs. */
export const PRIORITY_DESTINATIONS = [
  { id: 'suzanne-vermeer', path: '/collection/suzanne-vermeer', title: 'Met welk boek van Suzanne Vermeer begin je?', description: 'Kies op vakantiegevoel, rondreis of een kort verhaal. Bekijk ook welke verhalen aantoonbaar op elkaar aansluiten.' },
  { id: 'fantasy-om-mee-te-beginnen', path: '/toplijsten/fantasy-om-mee-te-beginnen', title: 'Fantasy voor beginners', description: 'Kies tussen een los verhaal en een reeks, van warmte en humor tot romantiek en avontuur.' },
  { id: 'na-project-hail-mary', path: '/toplijsten/na-project-hail-mary', title: 'Wat lees je na Project Hail Mary?', description: 'Vind je volgende boek via wetenschap, droge humor of het verkennen van het onbekende.' },
] as const;
export type PriorityDestinationId = typeof PRIORITY_DESTINATIONS[number]['id'];
export function priorityDestination(pathname: string) {
  // Dutch content only; preserve existing English functionality and reporting.
  return PRIORITY_DESTINATIONS.find(item => pathname === '/nl' + item.path);
}
