# BigImage

## General information

A [leaflet](http://www.leafletjs.com) plugin that allows users to download an image with a scaled-up version of the visible map.
* Opportunities:
  - Compatible with Leaflet v1+.
  - The ability to increase the area of the map without increasing.
  - Simple layers will show on image.
  - Tiles ssupport: OSM, MapBox, etc.


## Changelog
**14.12.2021**
- Add support multilayer export

## Downloads
**NPM**
````
	npm install --save leaflet.bigimage
````

## Usage

**Step 1.** Include the required js and css files in your document.

```html
  <link rel="stylesheet" href="dist/Leaflet.BigImage.min.css">
  <script src="dist/Leaflet.BigImage.min.js"></script>
```

**Step 2.** Add the following line of code to your map script. It is recommended if the height and width of the the png files to have 40px

``` js
	L.control.bigImage({
        position: 'topright', 
        clusterLargeImgSrc: '/content/large.png',
        clusterSmallImgSrc: '/content/small.png',
        clusterMediumImgSrc: '/content/medium.png'}).addTo(mymap);
```

**Step 3.**
You can pass a number of options to the plugin to control various settings.
| Option              | Type         | Default      | Description   |
| --------------------|--------------|--------------|---------------|
| position            | String       | 'topright'   | Position the print button |
| title               | String       | 'Get image'  | Sets the text which appears as the tooltip of the control button |
| printControlLabel   | String       | '&#128438;'  | Sets icon to the control button |
| printControlClasses | Array        | []           | Sets classes to the control button |
| maxScale            | Int          | 10           | Max image scale |
| minScale            | Int          | 1            | Min image scale |
| inputTitle          | String       | 'Choose scale:'  | Title before scale input |
| downloadTitle       | String       | 'Download'  | Text on the download button |
| clusterLargeImgSrc  | String       | ''          | path to icon to show large clusters
| clusterSmallImgSrc  | String       | ''          | path to icon to show small clusters
| clusterMediumImgSrc | String       | ''          | path to icon to show medium clusters
