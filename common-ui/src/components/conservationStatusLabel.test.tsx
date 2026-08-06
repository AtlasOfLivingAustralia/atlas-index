/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import {ConservationStatusLabel, conservationStatuses} from './conservationStatusLabel.tsx';

describe('ConservationStatusLabel', () => {
    it('renders the status code text', () => {
        render(<ConservationStatusLabel status="EN"/>);
        expect(screen.getByText('EN')).toBeInTheDocument();
    });

    it('does not render the label text by default', () => {
        render(<ConservationStatusLabel status="EN"/>);
        expect(screen.queryByText('Endangered')).not.toBeInTheDocument();
    });

    it('renders the label text when withLabel is true', () => {
        render(<ConservationStatusLabel status="EN" withLabel/>);
        expect(screen.getByText('Endangered')).toBeInTheDocument();
    });

    it('applies the background and text colours for the given status', () => {
        render(<ConservationStatusLabel status="CR"/>);
        const badge = screen.getByText('CR');
        expect(badge).toHaveStyle({background: conservationStatuses.CR.backgroundColour});
        expect(badge).toHaveStyle({color: conservationStatuses.CR.textColour});
    });

    it('uses default size and fontSize when not provided', () => {
        render(<ConservationStatusLabel status="LC"/>);
        const badge = screen.getByText('LC');
        expect(badge).toHaveStyle({width: '40px', height: '40px', fontSize: '16px'});
    });

    it('applies custom size and fontSize', () => {
        render(<ConservationStatusLabel status="LC" size={60} fontSize={20}/>);
        const badge = screen.getByText('LC');
        expect(badge).toHaveStyle({width: '60px', height: '60px', fontSize: '20px'});
    });

    it('renders correctly for each defined conservation status', () => {
        Object.keys(conservationStatuses).forEach(status => {
            const {unmount} = render(<ConservationStatusLabel status={status} withLabel/>);
            expect(screen.getByText(conservationStatuses[status].label)).toBeInTheDocument();
            unmount();
        });
    });
});
