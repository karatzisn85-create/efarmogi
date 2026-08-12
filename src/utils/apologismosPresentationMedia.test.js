/**
 * @jest-environment node
 */
import {
  collectPathsFromSlide,
  collectPathsForSlideWindow,
  collectPathsFromSlides,
  resolvePdfMediaVariant,
} from './apologismosPresentationMedia';

describe('apologismosPresentationMedia', () => {
  test('συλλέγει μόνο εμφανιζόμενα μέσα διαφάνειας έργου', () => {
    const slide = {
      type: 'project',
      page: {
        type: 'primary_photos',
        primary: { before: 'a.jpg', after: 'b.jpg', during: null },
        mapSnapshot: 'map.png',
      },
      entry: {
        card: {
          photos: { before: ['a.jpg', 'extra.jpg'], after: ['b.jpg'], during: ['c.jpg'] },
          mapSnapshot: 'unused-map.png',
        },
      },
    };
    expect(collectPathsFromSlide(slide).sort()).toEqual(['a.jpg', 'b.jpg', 'map.png'].sort());
  });

  test('παράθυρο διαφανειών δεν φορτώνει όλο το deck', () => {
    const slides = [
      { type: 'cover', cover: { images: [{ relativePath: 'cover.jpg' }] } },
      { type: 'toc' },
      { type: 'project', page: { primary: { after: 'p2.jpg' } } },
      { type: 'project', page: { primary: { after: 'p3.jpg' } } },
      { type: 'project', page: { primary: { after: 'p4.jpg' } } },
    ];
    expect(collectPathsForSlideWindow(slides, 2, 1).sort()).toEqual(['p2.jpg', 'p3.jpg'].sort());
    expect(collectPathsFromSlides(slides).sort()).toEqual(
      ['cover.jpg', 'p2.jpg', 'p3.jpg', 'p4.jpg'].sort()
    );
  });

  test('resolvePdfMediaVariant: πλήρες για μικρά, preview για μεγάλα', () => {
    expect(resolvePdfMediaVariant(10, 20)).toBe('full');
    expect(resolvePdfMediaVariant(41, 10)).toBe('preview');
    expect(resolvePdfMediaVariant(5, 61)).toBe('preview');
  });
});
