import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Link } from 'react-router-dom'
import type { SessionRecord } from '../types'

type SessionListItemProps = {
  session: SessionRecord
  deleteLabel: string
  statusLabel: string
  onDelete: (sessionId: string) => void
}

export function SessionListItem({
  session,
  deleteLabel,
  statusLabel,
  onDelete,
}: SessionListItemProps) {
  return (
    <Box
      sx={{
        '&:hover': {
          backgroundColor: 'action.hover',
        },
        alignItems: 'flex-start',
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        gap: 1.5,
        p: 2,
        transition: 'background-color 160ms ease',
      }}
    >
      <Box
        component={Link}
        sx={{ color: 'inherit', display: 'block', flex: 1, minWidth: 0, textDecoration: 'none' }}
        to={`/session/${session.id}`}
      >
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>
          {session.youtubeUrl}
        </Typography>
        <Box
          sx={{
            alignItems: 'center',
            color: 'text.secondary',
            display: 'flex',
            fontSize: 12,
            gap: 1.5,
            justifyContent: 'space-between',
            mt: 1,
          }}
        >
          <span>{statusLabel}</span>
          <span>{new Date(session.updatedAt).toLocaleString()}</span>
        </Box>
      </Box>
      <Button
        aria-label={deleteLabel}
        color="error"
        sx={{ minWidth: 0, px: 1.1 }}
        variant="outlined"
        onClick={() => onDelete(session.id)}
      >
        <DeleteOutlineIcon fontSize="small" />
      </Button>
    </Box>
  )
}