import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { SessionListItem } from './SessionListItem'
import type { SessionRecord, SessionStatus } from '../types'

type SessionListProps = {
  sessions: SessionRecord[]
  emptyText: string
  deleteLabel: string
  onDelete: (sessionId: string) => void
  getStatusLabel: (status: SessionStatus) => string
}

export function SessionList({
  sessions,
  emptyText,
  deleteLabel,
  onDelete,
  getStatusLabel,
}: SessionListProps) {
  return (
    <Stack spacing={1.5}>
      {sessions.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
          {emptyText}
        </Typography>
      ) : (
        sessions.map((session) => (
          <SessionListItem
            key={session.id}
            deleteLabel={deleteLabel}
            session={session}
            statusLabel={getStatusLabel(session.status)}
            onDelete={onDelete}
          />
        ))
      )}
    </Stack>
  )
}