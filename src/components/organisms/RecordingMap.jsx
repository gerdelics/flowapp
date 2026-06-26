import { memo } from 'react'
import RouteMap from '../RouteMap'

// Thin, memoized wrapper that fixes the RouteMap configuration used on the
// recording page (live recorded path + planned overlay, follow-current marker).
// Memoizing here means the map is skipped on the per-second countdown
// re-renders of RecordingPage, only updating when the path or location changes.
function RecordingMap({
  className,
  points,
  overlayPoints,
  recordedPathColor,
  plannedRoutePathColor,
  currentLocation,
  followCurrentLocation,
  onFollowChange,
  defaultZoom,
  onZoomLevelChange,
  fitRouteKey,
  onRefreshCurrentLocation,
  selectedRouteName,
  onOpenRoutePicker,
  onClearSelectedRoute,
  driveLink,
}) {
  return (
    <RouteMap
      className={className}
      points={points}
      overlayPoints={overlayPoints}
      pathColor={recordedPathColor}
      overlayPathColor={plannedRoutePathColor}
      currentLocation={currentLocation}
      driveModeEnabled={followCurrentLocation}
      onDriveModeChange={onFollowChange}
      showCurrentMarker
      defaultZoom={defaultZoom}
      onZoomLevelChange={onZoomLevelChange}
      fitRoute={false}
      fitRouteKey={fitRouteKey}
      showFullscreenControl
      showRouteControl
      selectedRouteName={selectedRouteName}
      onOpenRoutePicker={onOpenRoutePicker}
      onClearSelectedRoute={onClearSelectedRoute}
      onRefreshCurrentLocation={onRefreshCurrentLocation}
      driveLink={driveLink}
    />
  )
}

export default memo(RecordingMap)
