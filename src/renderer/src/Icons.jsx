/**
 * Icon wrapper — sources from @tabler/icons-react (MIT)
 * Exports with lucide-react-compatible names so no JSX changes needed.
 * Normalizes strokeWidth prop → stroke.
 */
import {
  IconRefresh,
  IconCheck,
  IconAlertTriangle,
  IconDownload,
  IconChevronDown,
  IconChevronUp,
  IconChevronRight,
  IconInfoCircle,
  IconPlus,
  IconServer,
  IconFolderOpen,
  IconPencil,
  IconTrash,
  IconPower,
  IconSettings,
  IconPlayerPlay,
  IconSquare,
  IconBolt,
  IconCopy,
  IconClock,
  IconWifi,
  IconUsers,
  IconArchive,
  IconSearch,
  IconX,
  IconHourglass,
  IconStar,
  IconUserMinus,
  IconShieldOff,
  IconBan,
  IconShield,
  IconPuzzle,
  IconFileText,
  IconWorld,
  IconPackage,
  IconBell,
  IconDeviceDesktop,
  IconFolderSymlink,
  IconDatabase,
  IconArrowLeft,
  IconArrowRight,
  IconEye,
  IconEyeOff,
  IconExternalLink,
  IconArrowUpCircle,
  IconFolderPlus,
  IconRotateClockwise,
  IconZip,
} from '@tabler/icons-react'

function wrap(TablerIcon) {
  return function Icon({ size = 24, strokeWidth, stroke, className, style, ...rest }) {
    return (
      <TablerIcon
        size={size}
        stroke={strokeWidth ?? stroke ?? 2}
        className={className}
        style={style}
        {...rest}
      />
    )
  }
}

export const RefreshCw        = wrap(IconRefresh)
export const RotateCcw        = wrap(IconRefresh)
export const Check            = wrap(IconCheck)
export const AlertTriangle    = wrap(IconAlertTriangle)
export const Download         = wrap(IconDownload)
export const ChevronDown      = wrap(IconChevronDown)
export const ChevronUp        = wrap(IconChevronUp)
export const ChevronRight     = wrap(IconChevronRight)
export const Info             = wrap(IconInfoCircle)
export const Plus             = wrap(IconPlus)
export const Server           = wrap(IconServer)
export const FolderOpen       = wrap(IconFolderOpen)
export const Pencil           = wrap(IconPencil)
export const Trash2           = wrap(IconTrash)
export const Power            = wrap(IconPower)
export const Settings         = wrap(IconSettings)
export const Play             = wrap(IconPlayerPlay)
export const Square           = wrap(IconSquare)
export const Zap              = wrap(IconBolt)
export const Copy             = wrap(IconCopy)
export const Clock            = wrap(IconClock)
export const Wifi             = wrap(IconWifi)
export const Users            = wrap(IconUsers)
export const Archive          = wrap(IconArchive)
export const Search           = wrap(IconSearch)
export const X                = wrap(IconX)
export const Timer            = wrap(IconHourglass)
export const Star             = wrap(IconStar)
export const UserX            = wrap(IconUserMinus)
export const ShieldOff        = wrap(IconShieldOff)
export const Ban              = wrap(IconBan)
export const Shield           = wrap(IconShield)
export const Puzzle           = wrap(IconPuzzle)
export const FileText         = wrap(IconFileText)
export const Globe            = wrap(IconWorld)
export const PackageOpen      = wrap(IconZip)
export const Bell             = wrap(IconBell)
export const Monitor          = wrap(IconDeviceDesktop)
export const FolderInput      = wrap(IconFolderSymlink)
export const HardDrive        = wrap(IconDatabase)
export const ArrowLeft        = wrap(IconArrowLeft)
export const ArrowRight       = wrap(IconArrowRight)
export const Eye              = wrap(IconEye)
export const EyeOff           = wrap(IconEyeOff)
export const ExternalLink     = wrap(IconExternalLink)
export const ArrowUpCircle    = wrap(IconArrowUpCircle)
export const RefreshCcw       = wrap(IconRefresh)
