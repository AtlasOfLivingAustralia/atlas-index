import { writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

// base url for spatial service
const baseSpatialUrl = process.argv[2] || "https://spatial.ala.org.au/ws";

// convert the regions.json into a file suitable for the regions page
const regions = JSON.parse(readFileSync('./public/regions.json', 'utf8'));
const regionsList = [];

function buildRegionsList() {
    console.log('regionsList.json building...');
    regions.forEach((region) => {
        console.log("Processing region: " + region.label, region.fid);
        // get the children of the region, if it is not an aggregation of other fields
        if (region.fid) {
            var layerName = getLayerName(region.fid);
            var itemChildren = getChildren(region.fid);
            if (itemChildren.length > 0) {
                regionsList.push({name: region.label, layerName: layerName, fid: region.fid, objects: itemChildren});
            }
        } else {
            var fieldList = [];
            region.fields.forEach((field) => {
                var layerName = getLayerName(field.fid);
                fieldList.push({name: field.label, layerName: layerName, fid: field.fid});
            });
            regionsList.push({name: region.label, fid: region.fid, fields: fieldList});
        }
    })

    // write speciesGroupsMap to ./public/speciesGroupsMap.json
    writeFileSync('./regionsList.json', JSON.stringify(regionsList, null, 2));
    console.log('./regionsList.json can now be copied to the public folder, e.g. static/regions/regionsList.json, regions, etc.');
    console.log('Confirm that the updated file is the same as the VITE_REGIONS_CONFIG_URL value in the .env file.');
}

function getLayerName(fid) {
    var url1 = baseSpatialUrl + "/field/" + fid + "?pageSize=0";
    var response1 = JSON.parse(execSync('curl -s ' + url1).toString().trim());
    if (response1 && response1.spid) {
        var url2 = baseSpatialUrl + "/layer/" + response1.spid;
        var response2 = JSON.parse(execSync('curl -s ' + url2).toString().trim());
        return response2.name;
    }
    return null;
}

function getChildren(fid) {
    // get the objects in this field
    var children = [];
    var url = baseSpatialUrl + "/field/" + fid;
    var response = JSON.parse(execSync('curl -s ' + url).toString().trim());
    if (response && response.objects && response.objects.length > 0) {
        response.objects.forEach((item) => {
            children.push({ name: item.name, description: item.description, pid: item.pid, bbox: item.bbox });
        });
    }

    // sort by name
    children.sort((a, b) => {
        return a.name.localeCompare(b.name);
    });

    return children;
}

buildRegionsList();

