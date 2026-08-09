/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {fireEvent, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import Pagination from './pagination.tsx';

describe('Pagination', () => {
    const baseProps = {
        page: 5,
        maxResults: 1000,
        pageSize: 10,
        deepPagingMaxPage: 100,
        onPageChange: jest.fn(),
        isMobile: false,
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('renders the current page as disabled/selected', () => {
        render(<Pagination {...baseProps} />);
        const current = screen.getByText('6');
        expect(current).toBeDisabled();
    });

    it('shows the first page button and ellipsis when far from the start', () => {
        render(<Pagination {...baseProps} />);
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getAllByText('...').length).toBeGreaterThanOrEqual(1);
    });

    it('does not show the first page button when on page 0 or 1', () => {
        render(<Pagination {...baseProps} page={0} />);
        const ones = screen.getAllByText('1');
        expect(ones.length).toBe(1);
        expect(ones[0]).toBeDisabled();
    });

    it('calls onPageChange with 0 when the first page button is clicked', () => {
        render(<Pagination {...baseProps} />);
        fireEvent.click(screen.getByText('1'));
        expect(baseProps.onPageChange).toHaveBeenCalledWith(0);
    });

    it('calls onPageChange with page - 2 when the previous-previous button is clicked', () => {
        render(<Pagination {...baseProps} />);
        fireEvent.click(screen.getByText('4'));
        expect(baseProps.onPageChange).toHaveBeenCalledWith(3);
    });

    it('calls onPageChange with page - 1 when the previous button is clicked', () => {
        render(<Pagination {...baseProps} />);
        fireEvent.click(screen.getByText('5'));
        expect(baseProps.onPageChange).toHaveBeenCalledWith(4);
    });

    it('calls onPageChange with page + 1 when the next page button is clicked', () => {
        render(<Pagination {...baseProps} />);
        fireEvent.click(screen.getByText('7'));
        expect(baseProps.onPageChange).toHaveBeenCalledWith(6);
    });

    it('calls onPageChange with page + 2 when the next-next page button is clicked', () => {
        render(<Pagination {...baseProps} />);
        fireEvent.click(screen.getByText('8'));
        expect(baseProps.onPageChange).toHaveBeenCalledWith(7);
    });

    it('shows the last page button and Next button when far from the end', () => {
        render(<Pagination {...baseProps} />);
        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText('Next')).toBeInTheDocument();
    });

    it('calls onPageChange with maxPage - 1 when the last page button is clicked', () => {
        render(<Pagination {...baseProps} />);
        fireEvent.click(screen.getByText('100'));
        expect(baseProps.onPageChange).toHaveBeenCalledWith(99);
    });

    it('calls onPageChange with page + 1 when the Next button is clicked', () => {
        render(<Pagination {...baseProps} />);
        fireEvent.click(screen.getByText('Next'));
        expect(baseProps.onPageChange).toHaveBeenCalledWith(6);
    });

    it('does not show last page/Next controls when close to the end', () => {
        render(<Pagination {...baseProps} page={97} maxResults={1000} pageSize={10} />);
        expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });

    it('respects deepPagingMaxPage to cap the visible maxPage', () => {
        render(<Pagination {...baseProps} deepPagingMaxPage={20} />);
        expect(screen.getByText('20')).toBeInTheDocument();
        expect(screen.queryByText('100')).not.toBeInTheDocument();
    });

    it('does not show pagination for first page with few results', () => {
        render(<Pagination {...baseProps} page={0} maxResults={5} pageSize={10} />);
        const ones = screen.getAllByText('1');
        expect(ones.length).toBe(1);
        expect(ones[0]).toBeDisabled();
        expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });

    it('applies mobile spacing styles when isMobile is true', () => {
        const {container} = render(<Pagination {...baseProps} isMobile={true} />);
        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.style.marginTop).toBe('30px');
    });

    it('applies desktop spacing styles when isMobile is false', () => {
        const {container} = render(<Pagination {...baseProps} isMobile={false} />);
        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.style.marginTop).toBe('60px');
    });
});
