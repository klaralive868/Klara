// PostgreSQL's `integer` columns are 32-bit signed — shared by every form
// parser that validates a value bound for one (resources' price/quantity,
// bookings'/public bookings' traveler count, travel inquiries' party
// size), so an unbounded submission fails as a field-validation message
// instead of reaching the DB and erroring generically.
export const PG_INTEGER_MAX = 2147483647;
