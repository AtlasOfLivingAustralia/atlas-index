/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.doi;

public class MintResponse {
    public String uuid;
    public String doi;
    public String error;
    public String landingPage;
    public String doiServiceLandingPage;
    public String status;

    public MintResponse(String uuid, String doi, String error, String landingPage, String doiServiceLandingPage, String status) {
        this.uuid = uuid;
        this.doi = doi;
        this.error = error;
        this.landingPage = landingPage;
        this.doiServiceLandingPage = doiServiceLandingPage;
        this.status = status;
    }
}
