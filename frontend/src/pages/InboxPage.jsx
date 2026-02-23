import React from 'react'
// import toast from "react-hot-toast";
import {useQuery} from "@tanstack/react-query";
import {dbApi} from "../lib/api.js";


const InboxPage = () => {

  // test: fetch some data
  const { data: inboxItems = [] } = useQuery({
    queryKey: ["inboxItems"],
    queryFn: dbApi.listInboxItems,
  });
  
  console.log("Inbox items:", inboxItems);
  return (
    <div>
      InboxPage
    </div>
  )
}

export default InboxPage;