/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb} from "@ala/common-ui";
import { useState, useEffect } from 'react';

function SensitiveDataServicePage({ setBreadcrumbs }: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
  const [xmlLastModified, setXmlLastModified] = useState('(loading...)');
  const sds_ws_url = import.meta.env.VITE_APP_SENSITIVE_WS_URL;
  const ssdXmlUrl = import.meta.env.VITE_APP_SENSITIVE_SPECIES_XML_URL || '/sensitive-species-data.xml';

  // set the breadcrumbs once on mount
  useEffect(() => {
    setBreadcrumbs([
      { title: 'Home', href: import.meta.env.VITE_HOME_URL },
      { title: 'Sensitive Data Service', href: import.meta.env.VITE_EXPLORE_URL }
    ]);
  }, []);

  useEffect(() => {
    async function getLastModified() {
      console.log('Fetching last modified date for:', ssdXmlUrl);
      try {
        const response = await fetch(ssdXmlUrl, { method: 'GET' });

        if (!response.ok) {
          throw new Error('Failed to fetch file information');
        }

        const lastModified = response.headers.get('last-modified');

        if (lastModified) {
          const date = new Date(lastModified);
          const formattedDate = date.toLocaleString('en-AU', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            timeZoneName: 'short'
          });
          setXmlLastModified(formattedDate);
        } else {
          setXmlLastModified('[Last-Modified header not available]');
        }
      } catch (error) {
        if (error instanceof Error) {
          setXmlLastModified('Error: <code>' + error.message + '</code>');
        } else {
          setXmlLastModified('An unknown error occurred');
        }
      }
    }

    getLastModified();
  }, []); // Empty dependency array means this effect runs once after the initial render

  return (
    <div className="container" id="main">
      <h2>Sensitive Data Service</h2>
      <p>
        The Sensitive Data Service (SDS) is the mechanism for providing security over data sensitivities. At the moment
        it supports:
      </p>
      <ul style={{ listStyleType: 'disc'}}>
        <li>Conservation Sensitivity, whereby sensitive species are denatured according to state rules. </li>
        <li>Pest Sensitivity. Species are passed through a set of rules based on categories as defined in the
          &nbsp;<b>Plant Biosecurity Sensitive Data Service</b>
        </li>
      </ul>
      <p>
        For more information see <a
          href={`${import.meta.env.VITE_APP_ALA_HELP_SENSITIVE_URL}`} target="_blank">Data
          Sensitivity</a>.
      </p>
      <h2>Testing</h2>
      <p>
        The Sensitive Data Service can be tested through the <a
        href={`${import.meta.env.VITE_APP_SENSITIVE_SWAGGER_URL}#/Conservation%20status%20management/report`} target="_blank">Sensitive
        Data Service API</a> (see the 'report' endpoint).
      </p>
      <h2>Resources</h2>
      <p>The Sensitive Data Service is controlled through a set of XML files.</p>

      <table className="table">
        <thead>
          <tr>
            <td>File</td>
            <td>Purpose</td>
            <td></td>
            <td></td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><a href={`${ssdXmlUrl}`} target="_blank">Sensitive Species Data</a></td>
            <td>The xml file that supplies all the sensitive species and the categories and zones to which they
              belong.</td>
            <td>This file was last generated on: <span id="xmlLastModified" dangerouslySetInnerHTML={{ __html: xmlLastModified }} />.</td>
            <td>
            </td>
          </tr>
          <tr>
            <td><a href={`${sds_ws_url}/categories`} target="_blank">Sensitive Categories</a></td>
            <td>The xml file that supplies the vocabulary for the sensitive categories.</td>
            <td>This is a static file.</td>
            <td></td>
          </tr>
          <tr>
            <td><a href={`${sds_ws_url}/zones`} target="_blank">Sensitive Zones</a></td>
            <td>The xml file that supplies the vocabulary for the sensitive zones.</td>
            <td>This is a static file.</td>
            <td></td>
          </tr>
          <tr>
            <td><a href={`${sds_ws_url}/layers`} target="_blank">List of sensitive layer IDs</a></td>
            <td>JSON list of layers that are required by the SDS</td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <p>
        The species that make up the individual components of the SDS can be viewed via the {' '}
          <a href={`${import.meta.env.VITE_APP_LISTS_URL}`} target="_blank">list tool</a>.
      </p>
    </div>
  );
}

export default SensitiveDataServicePage;
