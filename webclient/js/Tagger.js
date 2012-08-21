// Tagger.js

var TAGGER = TAGGER || {};
TAGGER.common = (function () {
   var common = {};

   common.radToDeg = 180 / Math.PI;
   common.degToRad = Math.PI / 180;

   // args should have keys theta1, phi1, theta2, and phi2
   common.box = function (args) {
      var box = {};
      box.irregular = false;

      // put thetas in range
      while (args.theta1 > Math.PI) {
         args.theta1 -= 2* Math.PI;
      }
      while (args.theta2 > Math.PI) {
         args.theta2 -= 2* Math.PI;
      }

      // figure out which theta is lower
      if (args.theta1 <= args.theta2) {
         box.theta1 = args.theta1;
         box.theta2 = args.theta2;
      } else {
         box.theta1 = args.theta2;
         box.theta2 = args.theta1;
      }

      // figure out which phi is lower
      if (args.phi1 <= args.phi2) {
         box.phi1 = args.phi1;
         box.phi2 = args.phi2;
      } else {
         box.phi1 = args.phi2;
         box.phi2 = args.phi1;
      }

      // see if we crossed the seam
      if (box.theta2 - box.theta1 >= 3.14) {
         box.irregular = true;
         var temp = box.theta1;
         box.theta1 = box.theta2;
         box.theta2 = temp;
      }

      function dtheta () {
         if (!box.irregular) {
            return box.theta2 - box.theta1;
         } else {
            return 2*Math.PI + box.theta2 - box.theta1;
         }
      }
      box.dtheta = dtheta;

      box.dphi = function () { return box.phi2 - box.phi1; };

      box.center = function () {
         var t_av = box.theta1 + dtheta()/2;
         if (t_av > Math.PI) {
            t_av = box.theta2 - dtheta()/2;
         }
         var p_av = (box.phi2 + box.phi1) / 2;
         return { theta: t_av, phi: p_av };
      };

      return box;
   };

   return common;
}());


TAGGER.error = {
   databaseError: 0,
   streetViewError: 1,
   ajaxError: 2
};


TAGGER.app = (function () {
   var app = {};

   // current panorama
   var _pano = {};

   // DOM elements
   var _container;
   var _preloader;
   var _scaleButtons = [];
   var _message;
   var _error;
   var _downloadButton;


   function showMessage (message) {
      showError('');
      _message.innerHTML = message;
   }
   app.showMessage = showMessage;

   function showError (error) {
      _error.innerHTML = error;
   }
   app.showError = showError;
		

   // sets the field of view and aspect ratio
   function setFov (fov_theta) {
      var aspect = window.innerHeight / window.innerWidth;
      var fov_phi = 2 * Math.atan(aspect * Math.tan(fov_theta / 2));
      var params = { theta: fov_theta, phi: fov_phi, 'aspect': aspect };
      TAGGER.orientation.setFov(params);
      TAGGER.graphics.setFov(params);
   }
   app.setFov = setFov;

   function startLoading () {
      TAGGER.handlers.disableTagging();
      showProgress(true);
      $(_downloadButton).off('click');
      $(_downloadButton).hide(500);
   }

   function finishLoading () {
      showProgress(false);
      TAGGER.handlers.enableTagging();
   }
   var abortLoading = finishLoading;


   // everything that should be done to change the panorama data
   function changePanoData (panodata) {
      TAGGER.graphics.changeTexture(panodata);
   }

   // everything that should be done to change the panorama metadata
   function changePanoMetadata (pano) {
      // change metadata
      TAGGER.dhtml.changePanoMetadata(pano);

      // change edges
      TAGGER.dhtml.removeEdges();
      for (i=0; i<pano.nedges; ++i) {
         (function (i) {
            TAGGER.dhtml.addEdge(pano.edges[i], function () {
               loadPanoramaByPanoidNear(pano.edges[i].panoid, pano.loc.lat, pano.loc.lon);
            });
         }(i));
      }

      // change tags
      TAGGER.tags.changePano(pano);

      // reorient pano
      var tiltAxis = new THREE.Vector3(Math.cos(pano.tiltYaw), 0, -Math.sin(pano.tiltYaw));
      var quat = new THREE.Quaternion(0, Math.sin(pano.panoYaw/2), 0, Math.cos(pano.panoYaw/2));
      quat.multiplySelf(new THREE.Quaternion().setFromAxisAngle(tiltAxis, pano.tiltPitch));
      TAGGER.graphics.orientQuat(quat);

      // move map
      TAGGER.map.moveMarker(pano.loc.lat, pano.loc.lon);
      TAGGER.map.moveMap(pano.loc.lat, pano.loc.lon);

      // show or hide download button
      if (!pano.indb) {
         $(_downloadButton).on('click', function () {
            downloadPanorama(pano.panoid)
         });
         $(_downloadButton).show(500);
      }

      // adjust url
      window.location.hash = pano.loc.lat + ',' + pano.loc.lon;

      // save new metadata object
      _pano = pano;
   }

   // changes data and metadata
   function changePanorama (pano, image) {
      changePanoData(image);
      changePanoMetadata(pano);
      if (pano.indb) {
         TAGGER.handlers.onGooglePano(false);
         showMessage('Panorama loaded from the database.');
      } else {
         TAGGER.handlers.onGooglePano(true);
         showMessage('Panorama loaded from Google Street View.');
      }
      finishLoading();
   }


   // loads the panorama image
   function loadDatabasePanorama (pano) {
      TAGGER.cloud.get_data(pano.id).done( function (image) {
         changePanorama(pano, image);
      }).fail( function(errorObj) {
         showError('Error while loading panorama: ' + errorObj.description);
         abortLoading();
      });
   }
 
   function loadGooglePanorama (pano) {
      TAGGER.gsv.getData(pano.panoid).done( function (image) {
         changePanorama(pano, image);
      }).fail( function(errorObj) {
         showError('Error while loading panorama: ' + errorObj.description);
         abortLoading();
      });
   }


   function loadDatabasePanoramaById (id) {
      startLoading();
      showMessage('Loading panorama ' + id + ' from the database.');
      TAGGER.cloud.get_metadata(id).done( loadDatabasePanorama ).fail( function(errorObj) {
         showError('Error while loading metadata: ' + errorObj.description);
         abortLoading();
      });
   }
            
   function loadPanoramaNear (lat, lon) {
      startLoading();
      showMessage('Searching in the database...');
      TAGGER.cloud.panoNear(lat, lon).done( loadDatabasePanorama ).fail( function (errorObj) {
         if (errorObj.type === TAGGER.error.databaseError) {
            loadGooglePanoramaNear(lat, lon);
         } else {
            showError('Could not communicate with the database.');
            abortLoading();
         }
      });
   }

   function loadGooglePanoramaNear (lat, lon) {
      showMessage('Searching in Google Street View...');
      TAGGER.gsv.panoidNear(lat, lon).done( loadGooglePanoramaByPanoid ).fail( function(errorObj) {
         if (errorObj.type === TAGGER.error.streetViewError) {
            showMessage('Could not find a panorama.');
         } else {
            showError('Could not communicate with Google Street View.');
         }
         abortLoading();
      });
   }

   function loadGooglePanoramaByPanoid (panoid) {
      showMessage('Searching in Google Street View...');
      TAGGER.gsv.getMetadata(panoid).done( loadGooglePanorama ).fail( function(errorObj) {
         showError('Error while loading Google metadata: ' + errorObj.description);
         abortLoading();
      });
   }

   function loadPanoramaByPanoidNear (panoid, lat, lon) {
      startLoading();
      showMessage('Searching in the database...');
      TAGGER.cloud.panoByPanoidNear(panoid, lat, lon).done( loadDatabasePanorama ).fail( function (errorObj) {
         if (errorObj.type === TAGGER.error.databaseError) {
            loadGooglePanoramaByPanoid(panoid);
         } else {
            showError('Could not communicate with the database.');
            abortLoading();
         }
      });
   }


   function downloadPanorama (panoid) {
      startLoading();
      showMessage('Saving panorama to the database...');
      TAGGER.cloud.downloadPanorama(panoid).done( loadDatabasePanorama ).fail( function (errorObj) {
         if (errorObj.type === TAGGER.error.databaseError) {
            showError('The database was unable to save the panorama.');
         } else {
            showError('Could not communicate with the database.');
         }
         abortLoading();
      });
   }


   // called when you click on an edge
   function loadEdge1 (edgeIndex) {
      var newpano = TAGGER.cloud.pano_id_near(_pano.edges[edgeIndex].panoid, _pano.loc.lat, _pano.loc.lon, loadEdge2);
   }

   function loadEdge2 (panoid, pano) {
      // if a pano argument is provided it means we found the desired pano in the database
      if (pano) {
         TAGGER.graphics.loadPano(pano.id);

         // remove old pano's tags and edges
         for (tagid in _pano.tags) {
            TAGGER.dhtml.removeTag(tagid);
         }
         TAGGER.dhtml.removeEdges();

         // display new pano
         updatePanoMetadata(pano);
      } else {
         var newpano = TAGGER.cloud.get_sv_metadata(panoid, loadEdge3);
      }
   }

   function loadEdge3 (pano) {
         TAGGER.graphics.loadPano(pano.id);

         // remove old pano's tags and edges
         for (tagid in _pano.tags) {
            TAGGER.dhtml.removeTag(tagid);
         }
         TAGGER.dhtml.removeEdges();
      
         // display new pano
         updatePanoMetadata(pano);
   }



   function showProgress( show ) {
      if (show === true) {
         //$(_preloader).show(500);
         $(_preloader).animate({ opacity: 1 }, 500);
      } else {
         //$(_preloader).hide(500);
         $(_preloader).animate({ opacity: 0 }, 500);
      }
   }


   // animation loop
   function animate () {
      TAGGER.graphics.render(TAGGER.orientation.cView());
      requestAnimationFrame(animate);
   }


   function quietSetZoom (z) {
      TAGGER.gsv.setZoom(z);
      for (var j=0; j<_scaleButtons.length; j+=1) {
         $(_scaleButtons[j]).removeClass('active');
         if (z == (j + 1)) {
            $(_scaleButtons[j]).addClass('active');
         }
      }
   }

   function setZoom (z) {
      quietSetZoom(z);
      if (_pano.indb === false) {
         showProgress(true);
         loadGooglePanorama(_pano);
      } else {
         showMessage('Quality only effects panoramas loaded from Google Street View.');
      }
   }
		

   // starts the app
   function start () {
      // get the loading bar up
      startLoading();

      // find where to start
      var pos;
      if (window.location.hash) {
         parts = window.location.hash.substr( 1 ).split( ',' );
         pos = { lat: parts[ 0 ], lon: parts[ 1 ] };
      } else {
         // maxwell dworkin
         pos = { lat: 42.378742, lon: -71.1166};
      }
      console.log(pos);

      // find DOM elements
      _container = document.getElementById("container");
      _preloader = document.getElementById("preloader");
      _message = document.getElementById("message");
      _error = document.getElementById("error");
      _downloadButton = document.getElementById("save_btn");

      // Initialize modules
      TAGGER.graphics.init(_container);
      TAGGER.map.initialize(pos.lat, pos.lon);
      TAGGER.map.setOnMoveMarker(loadPanoramaNear);
      TAGGER.tags.initialize(_pano);
      TAGGER.gsv.initialize();
      TAGGER.handlers.initialize(_container);

      // set fov
      setFov(Math.PI / 2);

      // set panorama
      // 3bc5169b = 1002772123
      // 84928c3  = 139012302
      //loadDatabasePanoramaById('3bc5169b');
      loadPanoramaNear(pos.lat, pos.lon);

      // bind scale button handlers
      for (var i=1; i<5; i+=1) {
         var el = document.getElementById('scale' + i);
         _scaleButtons.push(el);
         (function (z) {
            $(el).on('click', function(e) {
               e.preventDefault();
               setZoom(z);
            });
         })(i);
      }
      quietSetZoom(3);

      // start animating
      animate();
   }
   app.start = start;

   return app;
}());


// when page has loaded, start the app
$(document).ready(TAGGER.app.start);
