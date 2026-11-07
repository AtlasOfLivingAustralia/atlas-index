/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {fireEvent, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import ActiveFilters from './activeFilters';

describe('ActiveFilters', () => {
    const noop = jest.fn();

    it('renders nothing when there are no active filters', () => {
        const {container} = render(
            <ActiveFilters query={undefined} facetFilters={{}} criteria={[]} onRemoveQuery={noop} onRemoveFacet={noop} onRemoveCriterion={noop} onClearAll={noop}/>
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders a pill for the query, each facet value, and each criterion', () => {
        render(
            <ActiveFilters
                query="banksia"
                facetFilters={{dataResourceUid: ['dr1', 'dr2']}}
                criteria={[{id: 'c1', field: 'scientificName', label: 'Scientific name', operator: '=', value: 'Banksia serrata'}]}
                onRemoveQuery={noop}
                onRemoveFacet={noop}
                onRemoveCriterion={noop}
                onClearAll={noop}
            />
        );

        expect(screen.getByTestId('active-filter-query')).toHaveTextContent('q: banksia');
        expect(screen.getByText(/dataResourceUid: dr1/)).toBeInTheDocument();
        expect(screen.getByText(/dataResourceUid: dr2/)).toBeInTheDocument();
        expect(screen.getByText(/Scientific name = Banksia serrata/)).toBeInTheDocument();
    });

    it('invokes the correct callback when a pill is removed', () => {
        const onRemoveQuery = jest.fn();
        render(
            <ActiveFilters query="banksia" facetFilters={{}} criteria={[]} onRemoveQuery={onRemoveQuery} onRemoveFacet={noop} onRemoveCriterion={noop} onClearAll={noop}/>
        );
        fireEvent.click(screen.getByLabelText('Remove query'));
        expect(onRemoveQuery).toHaveBeenCalled();
    });

    it('invokes onClearAll when "Clear all" is clicked', () => {
        const onClearAll = jest.fn();
        render(
            <ActiveFilters query="banksia" facetFilters={{}} criteria={[]} onRemoveQuery={noop} onRemoveFacet={noop} onRemoveCriterion={noop} onClearAll={onClearAll}/>
        );
        fireEvent.click(screen.getByText('Clear all'));
        expect(onClearAll).toHaveBeenCalled();
    });
});
