'use client';
import {useMemo,type ComponentProps} from 'react';
import {getInitialBookCoverUrls} from '@/lib/books/book-cover-state';
import {getBookCoverIdentity} from '@/lib/books/bound-cover-state';
import {BookCoverForIdentity} from './LumiScoreHome';
/** Compatibility only; current catalogue responses provide exact bound URLs. */
export default function LegacyReviewedCover(props:ComponentProps<typeof BookCoverForIdentity>){
 const book=useMemo(()=>({...props.book,coverUrls:getInitialBookCoverUrls(props.book)}),[props.book]);
 return <BookCoverForIdentity key={getBookCoverIdentity(book)} {...props} book={book}/>;
}
