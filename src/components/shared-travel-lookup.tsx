"use client";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
type Flighty = { profile_id:string; display_name:string; flighty_url:string };
type Booking = { profile_id:string; display_name:string; traveler_name:string|null; details:string|null };
export function SharedTravelLookup({ flighty, booking }: { flighty:Flighty[]; booking:Booking[] }) {
  const [flightyId,setFlightyId]=useState(""); const [bookingId,setBookingId]=useState("");
  const selectedFlighty=flighty.find((row)=>row.profile_id===flightyId); const selectedBooking=booking.find((row)=>row.profile_id===bookingId);
  if (!flighty.length && !booking.length) return null;
  return <section className="panel shared-travel"><div className="panel__heading"><div><p className="eyebrow">Intentionally shared</p><h2>Team travel lookup</h2></div></div>
    {flighty.length>0 && <div className="shared-travel__lookup"><label className="form-field"><span>View shared Flighty for</span><select value={flightyId} onChange={(event)=>setFlightyId(event.target.value)}><option value="">Choose a member</option>{flighty.map((row)=><option value={row.profile_id} key={row.profile_id}>{row.display_name}</option>)}</select></label>{selectedFlighty&&<a className="secondary-button" href={selectedFlighty.flighty_url} target="_blank" rel="noreferrer">Open Flighty <ArrowUpRight size={15}/></a>}</div>}
    {booking.length>0 && <div className="shared-travel__lookup"><label className="form-field"><span>View shared travel prefs for</span><select value={bookingId} onChange={(event)=>setBookingId(event.target.value)}><option value="">Choose a member</option>{booking.map((row)=><option value={row.profile_id} key={row.profile_id}>{row.display_name}</option>)}</select></label>{selectedBooking&&<div className="shared-travel__details"><strong>{selectedBooking.traveler_name||selectedBooking.display_name}</strong><p>{selectedBooking.details||"No booking notes supplied."}</p><small>Read-only · explicitly shared with Production</small></div>}</div>}
  </section>;
}
