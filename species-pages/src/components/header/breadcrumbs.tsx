import { Anchor, Breadcrumbs, Text } from '@mantine/core';
import { IconChevronLeft } from '@tabler/icons-react';
import React, { useState } from 'react';
import { Breadcrumb } from '../../api/sources/model';
import classes from '../../App.module.css';
import { Link } from 'react-router-dom';

interface BreadcrumbsProps {
  breadcrumbValues: Breadcrumb[]; // Update the type to Breadcrumb[]
  separator?: React.ReactNode; // Optional separator component
  separatorMargin?: number; // Optional margin for separator
}

const BreadcrumbSection: React.FC<BreadcrumbsProps> = ({
  breadcrumbValues,
}) => {
  // const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const breadcrumbItems: any = breadcrumbValues.map((breadcrumb: Breadcrumb, index: number) => {
    return (
        <>
            {index < breadcrumbValues.length - 1 ? (
                <Anchor inherit component={Link} to={breadcrumb.href ? breadcrumb.href : '#'}>{breadcrumb.title}</Anchor>
            ) : (
                <>{breadcrumb.title}</>
            )
            }
        
        </>
      );
  });

  return (
    <div className="breadcrumbs"> {/* Add a class for styling */}
      <Breadcrumbs separator={<IconChevronLeft size={16} className={classes.breadcrumb}/>} separatorMargin={4} >
          {breadcrumbItems.map((item: any, index: number) => (
              <Text component='div' key={index} size="sm">{item}</Text>
          ))}
      </Breadcrumbs>
    </div>
  );
};

export default BreadcrumbSection;