export const QGIS_TURBO_COLORS = [
  '#30123b', '#466be3', '#29bbec', '#32f298', '#a4fc3c',
  '#f9ba38', '#f66b19', '#ca2518', '#7a0403'
];

const IRISH_GRID_SRS = `<spatialrefsys nativeFormat="Wkt">
  <wkt>PROJCRS["TM65 / Irish Grid",BASEGEOGCRS["TM65",DATUM["TM65",ELLIPSOID["Airy Modified 1849",6377340.189,299.3249646,LENGTHUNIT["metre",1]]],PRIMEM["Greenwich",0,ANGLEUNIT["degree",0.0174532925199433]],ID["EPSG",4299]],CONVERSION["Irish Grid",METHOD["Transverse Mercator",ID["EPSG",9807]],PARAMETER["Latitude of natural origin",53.5,ANGLEUNIT["degree",0.0174532925199433],ID["EPSG",8801]],PARAMETER["Longitude of natural origin",-8,ANGLEUNIT["degree",0.0174532925199433],ID["EPSG",8802]],PARAMETER["Scale factor at natural origin",1.000035,SCALEUNIT["unity",1],ID["EPSG",8805]],PARAMETER["False easting",200000,LENGTHUNIT["metre",1],ID["EPSG",8806]],PARAMETER["False northing",250000,LENGTHUNIT["metre",1],ID["EPSG",8807]]],CS[Cartesian,2],AXIS["(E)",east,ORDER[1],LENGTHUNIT["metre",1]],AXIS["(N)",north,ORDER[2],LENGTHUNIT["metre",1]],USAGE[SCOPE["Engineering survey, topographic mapping."],AREA["Ireland - onshore."],BBOX[51.39,-10.56,55.43,-5.93]],ID["EPSG",29902]]</wkt>
  <proj4>+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=1.000035 +x_0=200000 +y_0=250000 +a=6377340.189 +rf=299.3249646 +towgs84=482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15 +units=m +no_defs</proj4>
  <srsid>2564</srsid>
  <srid>29902</srid>
  <authid>EPSG:29902</authid>
  <description>TM65 / Irish Grid</description>
  <projectionacronym>tmerc</projectionacronym>
  <ellipsoidacronym>EPSG:7002</ellipsoidacronym>
  <geographicflag>false</geographicflag>
</spatialrefsys>`;

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, character => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  })[character]);
}

function qgisValue(value) {
  return Number(value.toPrecision(10)).toString();
}

function grayRenderer(opacity, minimum, maximum) {
  const hasRange = Number.isFinite(minimum) && Number.isFinite(maximum) && minimum < maximum;
  const rangeAttributes = hasRange
    ? ` classificationMin="${qgisValue(minimum)}" classificationMax="${qgisValue(maximum)}"`
    : '';
  const enhancement = hasRange
    ? `<contrastEnhancement>
            <minValue>${qgisValue(minimum)}</minValue>
            <maxValue>${qgisValue(maximum)}</maxValue>
            <algorithm>StretchToMinimumMaximum</algorithm>
          </contrastEnhancement>`
    : `<contrastEnhancement><algorithm>NoEnhancement</algorithm></contrastEnhancement>`;
  return `        <rasterrenderer alphaBand="-1" grayBand="1" nodataColor="" opacity="${qgisValue(opacity)}" type="singlebandgray"${rangeAttributes}>
          <rasterTransparency/>
          <minMaxOrigin>
            <limits>${hasRange ? 'MinMax' : 'None'}</limits>
            <extent>WholeRaster</extent>
            <statAccuracy>Estimated</statAccuracy>
            <cumulativeCutLower>0.02</cumulativeCutLower>
            <cumulativeCutUpper>0.98</cumulativeCutUpper>
            <stdDevFactor>2</stdDevFactor>
          </minMaxOrigin>
          ${enhancement}
        </rasterrenderer>
`;
}

export function buildQgisLayerDefinition({
  id,
  name,
  url,
  opacity = 1,
  minimum,
  maximum,
  colorStops = [],
  discrete = false,
  renderer = 'gray',
  crsAuthId = 'EPSG:29902'
}) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    throw new Error('A valid HTTP or HTTPS raster URL is required.');
  }
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new Error('Raster opacity must be between 0 and 1.');
  }

  const layerId = String(id || 'raster-layer').replace(/[^A-Za-z0-9_-]+/g, '_');
  const layerName = String(name || layerId);
  const source = `/vsicurl/${url}`;
  const spatialRef = crsAuthId === 'EPSG:29902'
    ? IRISH_GRID_SRS
    : `<spatialrefsys nativeFormat="Wkt"><authid>${escapeXml(crsAuthId)}</authid></spatialrefsys>`;
  let rendererXml = '';

  if (renderer === 'none') {
    rendererXml = '';
  } else if (!colorStops.length) {
    rendererXml = grayRenderer(opacity, minimum, maximum);
  } else {
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
      throw new Error('A varying finite raster value range is required for the color style.');
    }
    let previousValue = -Infinity;
    const items = colorStops.map(stop => {
      if (!Number.isFinite(stop.value) || stop.value <= previousValue
        || !/^#[\da-f]{6}$/i.test(stop.color)) {
        throw new Error('Raster color stops must have increasing values and six-digit hex colors.');
      }
      previousValue = stop.value;
      const value = qgisValue(stop.value);
      const label = stop.label || value;
      return `              <item alpha="255" color="${stop.color.toLowerCase()}" label="${escapeXml(label)}" value="${value}"/>`;
    }).join('\n');
    const styleMaximum = Math.max(maximum, previousValue);
    rendererXml = `        <rasterrenderer alphaBand="-1" band="1" classificationMax="${qgisValue(styleMaximum)}" classificationMin="${qgisValue(minimum)}" nodataColor="" opacity="${qgisValue(opacity)}" type="singlebandpseudocolor">
          <rasterTransparency/>
          <minMaxOrigin>
            <limits>MinMax</limits>
            <extent>WholeRaster</extent>
            <statAccuracy>Estimated</statAccuracy>
            <cumulativeCutLower>0.02</cumulativeCutLower>
            <cumulativeCutUpper>0.98</cumulativeCutUpper>
            <stdDevFactor>2</stdDevFactor>
          </minMaxOrigin>
          <rastershader>
            <colorrampshader classificationMode="${discrete ? '1' : '3'}" clip="0" colorRampType="${discrete ? 'DISCRETE' : 'INTERPOLATED'}" labelPrecision="6" maximumValue="${qgisValue(styleMaximum)}" minimumValue="${qgisValue(minimum)}">
${items}
            </colorrampshader>
          </rastershader>
        </rasterrenderer>
`;
  }

  return `<!DOCTYPE qgis-layer-definition>
<qlr>
  <layer-tree-group checked="Qt::Checked" expanded="1" groupLayer="" name="" wms-group-request-mode="Normal">
    <customproperties>
      <Option/>
    </customproperties>
    <layer-tree-layer checked="Qt::Checked" expanded="1" id="${escapeXml(layerId)}" legend_exp="" legend_split_behavior="0" name="${escapeXml(layerName)}" patch_size="-1,-1" providerKey="gdal" source="${escapeXml(source)}">
      <customproperties>
        <Option/>
      </customproperties>
    </layer-tree-layer>
  </layer-tree-group>
  <maplayers>
    <maplayer autoRefreshMode="Disabled" autoRefreshTime="0" hasScaleBasedVisibilityFlag="0" layerType="Raster" legendPlaceholderImage="" maxScale="0" minScale="1e+08" refreshOnNotifyEnabled="0" refreshOnNotifyMessage="" styleCategories="AllStyleCategories" type="raster">
      <id>${escapeXml(layerId)}</id>
      <datasource>${escapeXml(source)}</datasource>
      <layername>${escapeXml(layerName)}</layername>
      <srs>
        ${spatialRef}
      </srs>
      <provider>gdal</provider>
      <noData>
        <noDataList bandNo="1" useSrcNoData="1"/>
      </noData>
      <pipe>
        <provider>
          <resampling enabled="false" maxOversampling="2" zoomedInResamplingMethod="nearestNeighbour" zoomedOutResamplingMethod="nearestNeighbour"/>
        </provider>
${rendererXml}        <brightnesscontrast brightness="0" contrast="0" gamma="1"/>
        <huesaturation colorizeBlue="128" colorizeGreen="128" colorizeOn="0" colorizeRed="255" colorizeStrength="100" grayscaleMode="0" invertColors="0" saturation="0"/>
        <rasterresampler maxOversampling="2" zoomedInResampler="bilinear" zoomedOutResampler="bilinear"/>
        <resamplingStage>resamplingFilter</resamplingStage>
      </pipe>
      <blendMode>0</blendMode>
      <legend/>
    </maplayer>
  </maplayers>
</qlr>
`;
}
