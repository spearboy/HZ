export type Ticket = { id: string; subject: string; body: string; reply: string | null; created_at: string; replied_at: string | null }
export const supportFields = 'id,subject,body,reply,created_at,replied_at'
