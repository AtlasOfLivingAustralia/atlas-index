/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {fireEvent, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import {FadeInImage} from './fadeInImage.tsx';

describe('FadeInImage', () => {
    beforeAll(() => {
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            width: 100,
            height: 80,
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            x: 0,
            y: 0,
            toJSON: () => {
            },
        });
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it('renders an img element', () => {
        render(<FadeInImage src="pic.jpg" missingImage="missing.jpg" alt="pic"/>);
        expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('has opacity 0 before the image loads', () => {
        render(<FadeInImage src="pic.jpg" missingImage="missing.jpg" alt="pic"/>);
        const img = screen.getByRole('img');
        expect(img).toHaveStyle({opacity: 0});
    });

    it('has opacity 1 after the image loads', () => {
        render(<FadeInImage src="pic.jpg" missingImage="missing.jpg" alt="pic"/>);
        const img = screen.getByRole('img');
        fireEvent.load(img);
        expect(img).toHaveStyle({opacity: 1});
    });

    it('replaces the src with missingImage and calls onError on error', () => {
        const onError = jest.fn();
        render(<FadeInImage src="pic.jpg" missingImage="missing.jpg" alt="pic" onError={onError}/>);
        const img = screen.getByRole('img') as HTMLImageElement;
        fireEvent.error(img);
        expect(img.src).toContain('missing.jpg');
        expect(onError).toHaveBeenCalled();
    });

    it('shows a placeholder before loading when usePlaceholder is true', () => {
        const {container} = render(<FadeInImage src="pic.jpg" missingImage="missing.jpg" alt="pic" usePlaceholder/>);
        expect(container.querySelector('.placeholder-glow')).toBeInTheDocument();
    });

    it('removes the placeholder after the image loads', () => {
        const {container} = render(<FadeInImage src="pic.jpg" missingImage="missing.jpg" alt="pic" usePlaceholder/>);
        fireEvent.load(screen.getByRole('img'));
        expect(container.querySelector('.placeholder-glow')).not.toBeInTheDocument();
    });

    it('shows a loading spinner before loading when showLoadingSpinner is true', () => {
        render(<FadeInImage src="pic.jpg" missingImage="missing.jpg" alt="pic" showLoadingSpinner/>);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('removes the loading spinner after the image loads', () => {
        render(<FadeInImage src="pic.jpg" missingImage="missing.jpg" alt="pic" showLoadingSpinner/>);
        fireEvent.load(screen.getByRole('img'));
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('wraps the image in a sized div when calcDimensions is true (default)', () => {
        const {container} = render(<FadeInImage src="pic.jpg" missingImage="missing.jpg" alt="pic" placeholderDimensions={[50, 60]}/>);
        const wrapper = container.querySelector('img')?.parentElement as HTMLElement;
        expect(wrapper.style.minWidth).toBe('50px');
        expect(wrapper.style.minHeight).toBe('60px');
    });

    it('does not wrap the image in a sized div when calcDimensions is false', () => {
        const {container} = render(<FadeInImage src="pic.jpg" missingImage="missing.jpg" alt="pic" calcDimensions={false}/>);
        expect(container.firstChild).toBe(screen.getByRole('img'));
    });
});
