import React, { Attributes } from 'react';
import { PropsWithChildren } from 'react';

import { Navigate, useParams } from 'react-router-dom';

export type NumberParamContainerProps = {
  paramName: string;
} & PropsWithChildren;

export function NumberParamContainer({ children, paramName }: NumberParamContainerProps) {
  const { [paramName]: param } = useParams();

  const paramParsed = parseInt(param!);
  
  if (isNaN(paramParsed)) return <Navigate to="/" replace/>

  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { param: paramParsed } as Attributes);
    }
    return child;
  });

  return (
    <>
      {childrenWithProps}
    </>
  );
}

export default NumberParamContainer;