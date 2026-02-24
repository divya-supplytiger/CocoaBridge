import React from 'react'

const Row = ({ children, onClick }) => {
  return (
    <tr
      onClick={onClick}
      className={onClick ? "cursor-pointer hover:bg-accent/20" : ""}
    >
      {children ? children : "-"}
    </tr>
  )
};

export default Row;
