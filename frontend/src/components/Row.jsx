import React from 'react'

const Row = ({ children, onClick }) => {
  return (
    <tr
      onClick={onClick}
      className={onClick ? "cursor-pointer hover:bg-base-300" : ""}
    >
      {children ? children : "-"}
    </tr>
  )
};

export default Row;
