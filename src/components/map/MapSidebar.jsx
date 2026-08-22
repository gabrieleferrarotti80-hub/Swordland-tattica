import React from 'react';
import MapSidebarAlliance from './sidebars/MapSidebarAlliance';
import MapSidebarTactical from './sidebars/MapSidebarTactical';
import MapSidebarGlobal from './sidebars/MapSidebarGlobal';

export default function MapSidebar(props) {
  if (props.activeView === 'alliance') {
    return <MapSidebarAlliance {...props} />;
  }
  
  if (props.activeView === 'tactical') {
    return <MapSidebarTactical {...props} />;
  }
  
  return <MapSidebarGlobal {...props} />;
}