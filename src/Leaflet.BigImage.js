/*
 Leaflet.BigImage (https://github.com/pasichnykvasyl/Leaflet.BigImage).
 (c) 2020, Vasyl Pasichnyk, pasichnykvasyl (Oswald)
*/

(function (factory, window) {

    // define an AMD module that relies on 'leaflet'
    if (typeof define === 'function' && define.amd) {
        define(['leaflet'], factory);

        // define a Common JS module that relies on 'leaflet'
    } else if (typeof exports === 'object') {
        module.exports = factory(require('leaflet'));
    }

    // attach your plugin to the global 'L' variable
    if (typeof window !== 'undefined' && window.L) {
        window.L.YourPlugin = factory(L);
    }
}(function (L) {

    L.Control.BigImage = L.Control.extend({
        options: {
            position: 'topright',
            title: 'Get image',
            printControlLabel: "\uD83D\uDCE5",
            printControlClasses: [],
            printControlTitle: 'Get image',
            _unicodeClass: 'bigimage-unicode-icon',
            maxScale: 10,
            minScale: 1,
            inputTitle: 'Choose scale:',
            downloadTitle: 'Download',
            clusterLargeImgSrc: '',
            clusterSmallImgSrc: '',
            clusterMediumImgSrc: '',
            circleIcons: []
        },

        onAdd: function (map) {
            this._map = map;

            const title = this.options.printControlTitle;
            const label = this.options.printControlLabel;
            let classes = this.options.printControlClasses;

            if (label.indexOf('&') != -1) classes.push(this.options._unicodeClass);

            return this._createControl(label, title, classes, this._click, this);
        },

        _click: function (e) {
            this._loader.style.display = 'block';
            this._print();
        },

        _createControl: function (label, title, classesToAdd, fn, context) {

            this._container = document.createElement('div');
            this._container.id = 'print-container';
            this._container.classList.add('leaflet-bar');
            this._container.classList.add('print-hover');

            this._createControlPanel(classesToAdd, context, label, title, fn);

            L.DomEvent.disableScrollPropagation(this._container);
            L.DomEvent.disableClickPropagation(this._container);

            return this._container;
        },

        _createControlPanel: function (classesToAdd, context, label, title, fn) {
            let controlPanel = document.createElement('a');
            controlPanel.innerHTML = label;
            controlPanel.id = 'print-btn';
            controlPanel.setAttribute('title', title);
            classesToAdd.forEach(function (c) {
                controlPanel.classList.add(c);
            });
            L.DomEvent.on(controlPanel, 'click', fn, context);

            this._container.appendChild(controlPanel);
            this._controlPanel = controlPanel;

            this._loader = document.createElement('div');
            this._loader.id = 'print-loading';
            this._container.appendChild(this._loader);
        },

        _getLayers: function (resolve) {
            let self = this;
            let promises = [];
            self._map.eachLayer(function (layer) {
                promises.push(new Promise((new_resolve) => {
                    try {
                        if (layer instanceof L.Marker) {
                            self._getMarkerLayer(layer, new_resolve)
                        } else if (layer instanceof L.TileLayer) {
                            self._getTileLayer(layer, new_resolve);
                        } else if (layer instanceof L.Circle) {
                            if (!self.circles[layer._leaflet_id]) {
                                self.circles[layer._leaflet_id] = layer;
                            }
                            new_resolve();
                        } else if (layer instanceof L.Path) {
                            self._getPathLayer(layer, new_resolve);
                        } else if(layer instanceof L.MarkerClusterGroup){
                            self._getMarkerClusterLayer(layer, new_resolve);
                        } else {
                            new_resolve();
                        }
                    } catch (e) {
                        new_resolve();
                    }
                }));
            });
            Promise.all(promises).then(() => {
                resolve()
            });
        },

        /**
         * Loads the layer for the map
         * @param {*} layer 
         * @param {*} resolve 
         */
        _getTileLayer: function (layer, resolve) {
            let self = this;

            self.tiles = [];
            self.tileSize = layer._tileSize.x;
            self.tileBounds = L.bounds(self.bounds.min.divideBy(self.tileSize)._floor(), self.bounds.max.divideBy(self.tileSize)._floor());

            for (let j = self.tileBounds.min.y; j <= self.tileBounds.max.y; j++)
                for (let i = self.tileBounds.min.x; i <= self.tileBounds.max.x; i++)
                    self.tiles.push(new L.Point(i, j));

            let promiseArray = [];
            self.tiles.forEach(tilePoint => {
                let originalTilePoint = tilePoint.clone();
                if (layer._adjustTilePoint) layer._adjustTilePoint(tilePoint);

                let tilePos = originalTilePoint.scaleBy(new L.Point(self.tileSize, self.tileSize)).subtract(self.bounds.min);

                if (tilePoint.y < 0) return;
                promiseArray.push(new Promise(resolve => {
                    self._loadTile(tilePoint, tilePos, layer, resolve);
                }));
            });

            Promise.all(promiseArray).then(() => {
                resolve();
            });
        },

        _loadTile: function (tilePoint, tilePos, layer, resolve) {
            let self = this;
            let imgIndex = tilePoint.x + ':' + tilePoint.y + ':' + self.zoom;
            self.tilesImgs[layer._leaflet_id] = {};
            let image = new Image();
            image.crossOrigin = 'Anonymous';
            image.onload = function () {
                if (!self.tilesImgs[layer._leaflet_id][imgIndex]) self.tilesImgs[layer._leaflet_id][imgIndex] = { img: image, x: tilePos.x, y: tilePos.y, opacity: layer.options.opacity };
                resolve();
            };
            image.src = layer.getTileUrl(tilePoint);
        },

        _getMarkerLayer: function (layer, resolve) {
            let self = this;

            if (self.markers[layer._leaflet_id]) {
                resolve();
                return;
            }

            let pixelPoint = self._map.project(layer._latlng);
            pixelPoint = pixelPoint.subtract(new L.Point(self.bounds.min.x, self.bounds.min.y));

            if (layer.options.icon && layer.options.icon.options && layer.options.icon.options.iconAnchor) {
                pixelPoint.x -= layer.options.icon.options.iconAnchor[0];
                pixelPoint.y -= layer.options.icon.options.iconAnchor[1];
            }

            if (!self._pointPositionIsNotCorrect(pixelPoint) && layer._icon.src) {
                
                let image = new Image();
                image.crossOrigin = 'Anonymous';
                image.src = layer._icon.src
                var toolTip = layer._tooltip?._content;                ;
                image.onload = function () {
                    self.markers[layer._leaflet_id] = { img: image, x: pixelPoint.x, y: pixelPoint.y, tooltip: toolTip};
                    resolve();
                };
                return;
            } else if (!self._pointPositionIsNotCorrect(pixelPoint) && layer._icon.innerHTML && !layer._icon.src && !layer._childCount) {
                let html = new Text(layer._icon.innerHTML);
                self.markers[layer._leaflet_id] = { html: html, x: pixelPoint.x, y: pixelPoint.y };
                resolve();
            } else {
                resolve();
            }
        },

        _pointPositionIsNotCorrect: function (point) {
            return (point.x < 0 || point.y < 0 || point.x > this.canvas.width || point.y > this.canvas.height);
        },

        _getPathLayer: function (layer, resolve) {
            let self = this;
            if(layer._radius > 0){
                self._getCircleMarker(layer, resolve);
            }   
            else{
                self._getPath(layer, resolve);
            }
        },

        _getPath: function(layer, resolve){
            let self = this;

            let correct = 0;
            let parts = [];

            if (layer._mRadius || !layer._latlngs) {
                resolve();
                return;
            }

            let latlngs = layer.options.fill ? layer._latlngs[0] : layer._latlngs;
            if (Array.isArray(latlngs[0])) { latlngs = latlngs.flat(); }
            latlngs.forEach((latLng) => {
                let pixelPoint = self._map.project(latLng);
                pixelPoint = pixelPoint.subtract(new L.Point(self.bounds.min.x, self.bounds.min.y));
                parts.push(pixelPoint);
                if (pixelPoint.x < self.canvas.width && pixelPoint.y < self.canvas.height) correct = 1;
            });

            if (correct) self.path[layer._leaflet_id] = {
                parts: parts,
                closed: layer.options.fill,
                options: layer.options
            };
            resolve();
        },
         _getCircleMarker: function(layer, resolve){
            let self = this;
            let options = this.options;
            let promiseArray = [];

            if (self.markers[layer._leaflet_id]) {
                resolve();
                return;
            }

            let pixelPoint = self._map.project(layer._latlng);
            pixelPoint = pixelPoint.subtract(new L.Point(self.bounds.min.x, self.bounds.min.y));

            if (layer.options.icon && layer.options.icon.options && layer.options.icon.options.iconAnchor) {
                pixelPoint.x -= layer.options.icon.options.iconAnchor[0];
                pixelPoint.y -= layer.options.icon.options.iconAnchor[1];
            }
           

            promiseArray.push(new Promise(resolve => {
                self._getCircleImage(layer._leaflet_id, pixelPoint, layer.options.fillColor, options.circleIcons, resolve);
            })); 
            Promise.all(promiseArray).then(() => {
                resolve();
            });
         },
         _getCircleImage: function(leaflet_id, pixelPoint, color, circleIcons, resolve){
            let self = this;
            const imageUrl =  circleIcons.find(({name}) => name.toUpperCase() === color.toUpperCase());
            let image = new Image();
            image.crossOrigin = 'Anonymous';          
            image.onload = function () {
                self.markers[leaflet_id] = { img: image, x: pixelPoint.x - 13, y: pixelPoint.y - 13};
                resolve();
            };
            image.onerror = function() {
                resolve();
            };
            image.src = imageUrl ? imageUrl.path : circleIcons[0].path;
         },

        _getMarkerClusterLayer: function (layer, resolve) {
            let self = this;
            var visibleClusterMarkers = [];
            let options = this.options;
            let promiseArray = [];
            layer.eachLayer(function (marker) {
                parent = layer.getVisibleParent(marker);
                if (parent && (typeof visibleClusterMarkers[parent._leaflet_id] == 'undefined')
                        && parent.options.icon.options.iconUrl == undefined) {     
                    var parentLeaftletPos = parent._icon._leaflet_pos;
                    var childCount = parent._childCount;
                    var imageSrc = '';
                    if(childCount < 10){ // small
                        imageSrc = options.clusterSmallImgSrc;              
                    }
                    else if(childCount >= 10 && childCount < 100){ // medimum
                        imageSrc = options.clusterMediumImgSrc;
                    }
                    else{ // larger
                        imageSrc = options.clusterLargeImgSrc;
                    } 
                    promiseArray.push(new Promise(resolve => {
                        self._loadClusterMarker(parent._leaflet_id, parentLeaftletPos, imageSrc, childCount, resolve);
                    })); 
                  visibleClusterMarkers[parent._leaflet_id] = parent;
                }
              });
              Promise.all(promiseArray).then(() => {
                resolve();
            });
        },

        _loadClusterMarker: function(parentLeaftletId, parentLeaftletPos, imageSrc, childCount, resolve){
            let self = this;
            let image = new Image();
            image.crossOrigin = 'Anonymous';
            image.onload = function () {
                self.markers[parentLeaftletId] = { 
                    img : image,
                    text: childCount,
                    x: parentLeaftletPos.x, 
                    y: parentLeaftletPos.y
                }; 
                resolve();
            };
            image.onerror = function() {
                resolve();
            };
            image.src = imageSrc;
        },

        _changeScale: function (scale) {
            if (!scale || scale <= 1) return 0;

            let addX = (this.bounds.max.x - this.bounds.min.x) / 2 * (scale - 1);
            let addY = (this.bounds.max.y - this.bounds.min.y) / 2 * (scale - 1);

            this.bounds.min.x -= addX;
            this.bounds.min.y -= addY;
            this.bounds.max.x += addX;
            this.bounds.max.y += addY;

            this.canvas.width *= scale;
            this.canvas.height *= scale;
        },

        _drawPath: function (value) {
            let self = this;

            self.ctx.beginPath();
            let count = 0;
            let options = value.options;
            value.parts.forEach((point) => {
                self.ctx[count++ ? 'lineTo' : 'moveTo'](point.x, point.y);
            });

            if (value.closed) self.ctx.closePath();

            this._feelPath(options);
        },

        _drawText: function (layer, resolve) {
            let oldColour = this.ctx.fillStyle;
            this.ctx.font = "regular 16px arial";
            this.ctx.fillStyle = 'white';
            this.ctx.fillText(layer.html.nodeValue, layer.x, layer.y)
            this.ctx.fillStyle = oldColour;
        },

        _drawCircle: function (layer, resolve) {

            if (layer._empty()) {
                return;
            }

            let point = this._map.project(layer._latlng);
            point = point.subtract(new L.Point(this.bounds.min.x, this.bounds.min.y));

            let r = Math.max(Math.round(layer._radius), 1),
                s = (Math.max(Math.round(layer._radiusY), 1) || r) / r;

            if (s !== 1) {
                this.ctx.save();
                this.scale(1, s);
            }

            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y / s, r, 0, Math.PI * 2, false);

            if (s !== 1) {
                this.ctx.restore();
            }

            this._feelPath(layer.options);
        },

        _feelPath: function (options) {

            if (options.fill) {
                this.ctx.globalAlpha = options.fillOpacity;
                this.ctx.fillStyle = options.fillColor || options.color;
                this.ctx.fill(options.fillRule || 'evenodd');
            }

            if (options.stroke && options.weight !== 0) {
                if (this.ctx.setLineDash) {
                    this.ctx.setLineDash(options && options._dashArray || []);
                }
                this.ctx.globalAlpha = options.opacity;
                this.ctx.lineWidth = options.weight;
                this.ctx.strokeStyle = options.color;
                this.ctx.lineCap = options.lineCap;
                this.ctx.lineJoin = options.lineJoin;
                this.ctx.stroke();
            }
        },

        _print: function () {
            let self = this;

            self.tilesImgs = {};
            self.markers = {};
            self.path = {};
            self.circles = {};

            let dimensions = self._map.getSize();

            self.zoom = self._map.getZoom();
            self.bounds = self._map.getPixelBounds();

            self.canvas = document.createElement('canvas');
            self.canvas.width = dimensions.x;
            self.canvas.height = dimensions.y;
            self.ctx = self.canvas.getContext('2d');

            this._changeScale(1);

            let promise = new Promise(function (resolve, reject) {
                self._getLayers(resolve);
            });
            promise.then(() => {
                return new Promise(((resolve, reject) => {
                    for (const [key, layer] of Object.entries(self.tilesImgs)) {
                        for (const [key, value] of Object.entries(layer)) {
                            self.ctx.globalAlpha = value.opacity;
                            self.ctx.drawImage(value.img, value.x, value.y, self.tileSize, self.tileSize);
                            self.ctx.globalAlpha = 1;
                        }
                    }
                    for (const [key, value] of Object.entries(self.path)) {
                        self._drawPath(value);
                    }
                    for (const [key, value] of Object.entries(self.markers)) {
                        if (!(value instanceof HTMLImageElement) && !value.img && !value.tooltip && !value.text && value.html) {                   
                            self._drawText(value, value.x, value.y);
                        }else if(!(value instanceof HTMLImageElement) && value.img && value.tooltip && !value.text) { // node with image and tooltip
                            self.ctx.drawImage(value.img, value.x, value.y);
                            let oldColour = self.ctx.fillStyle;
                            self.ctx.font = "bold 14px arial";
                            self.ctx.fillStyle = 'black';
                            self.ctx.fillText(value.tooltip, value.x, value.y+22)
                            self.ctx.fillStyle = oldColour;  
        
                        }else if(!(value instanceof HTMLImageElement) && value.img && value.text && !value.tooltip){ // cluster node
                            self.ctx.drawImage(value.img, value.x -20, value.y - 20);
                            let oldColour = self.ctx.fillStyle;
                            self.ctx.font = "15px arial";
                            self.ctx.fillStyle = 'black';
                            const xAxis = value.text < 10 ? value.x-4 : value.x-8;
                            self.ctx.fillText(value.text, xAxis, value.y+5)
                            self.ctx.fillStyle = oldColour;   
                              
                        } else { // node with only image
                            self.ctx.drawImage(value.img, value.x, value.y);
                        }
                    }
                    for (const [key, value] of Object.entries(self.circles)) {
                        self._drawCircle(value);
                    }
                    resolve();
                }));
            }).then(() => {
                self.canvas.toBlob(function (blob) {
                    let link = document.createElement('a');
                    link.download = "mapExport.png";
                    link.href = URL.createObjectURL(blob);
                    link.click();
                });
                self._loader.style.display = 'none';
            });
        }
    });

    L.control.bigImage = function (options) {
        return new L.Control.BigImage(options);
    };
}, window));