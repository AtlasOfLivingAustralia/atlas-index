import React from "react";
import classes from "./pagination.module.css";

interface PaginationProps {
    page: number;
    maxResults: number;
    pageSize: number;
    deepPagingMaxPage: number;
    onPageChange: (page: number) => void;
    isMobile: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
                                                   page,
                                                   maxResults,
                                                   pageSize,
                                                   deepPagingMaxPage,
                                                   onPageChange,
                                                   isMobile
                                               }) => {
    const maxPage = Math.min(deepPagingMaxPage, Math.ceil(maxResults / pageSize));

    return (
        <div className="d-flex justify-content-center"
             style={{ marginTop: isMobile ? "30px" : "60px", columnGap: isMobile ? "5px" : "10px" }}>
            {page > 2 && (
                <>
                    <button className={classes.paginationButton}
                            onClick={() => onPageChange(0)}
                    >1</button>
                    {page > 3 && <div className={classes.paginationSpacer}>...</div>}
                </>
            )}

            {page - 1 > 0 && (
                <button className={classes.paginationButton}
                        onClick={() => onPageChange(page - 2)}>{page - 1}</button>
            )}
            {page > 0 && (
                <button className={classes.paginationButton}
                        onClick={() => onPageChange(page - 1)}>{page}</button>
            )}
            <button className={classes.paginationButtonSelected} disabled={true}>{page + 1}</button>
            {page + 1 < maxPage && (
                <button className={classes.paginationButton}
                        onClick={() => onPageChange(page + 1)}>{page + 2}</button>
            )}
            {page + 2 < maxPage && (
                <button className={classes.paginationButton}
                        onClick={() => onPageChange(page + 2)}>{page + 3}</button>
            )}

            {maxPage > page + 3 && page < deepPagingMaxPage && (
                <>
                    {maxPage > page + 4 && <div className={classes.paginationSpacer}>...</div>}
                    <button className={classes.paginationButton}
                            onClick={() => onPageChange(maxPage - 1)}
                    >{maxPage}</button>
                    <button className={`${classes.paginationButton} ${classes.next}`}
                            onClick={() => onPageChange(page + 1)}
                    >Next</button>
                </>
            )}
        </div>
    );
};

export default Pagination;
