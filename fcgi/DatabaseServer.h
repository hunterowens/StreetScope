//==============================================================================
// DatabaseServer.h
// Created May 31 2012
//==============================================================================

#ifndef DATABASE_SERVER
#define DATABASE_SERVER

#include <iostream>

#include "Cgicc.h"
#include "Database.h"
#include "DatabaseXML.h"
#include "pugixml.hpp"


//==============================================================================
// Class DatabaseServer
//==============================================================================

class DatabaseServer {
private:
   PhotoDatabase& _db;
   DatabaseXML _xml;

public:
   DatabaseServer (PhotoDatabase& db): _db(db), _xml(db) {}

   // cmd=status
   std::ostream& status (std::ostream& os, cgicc::Cgicc const& cgi, bool failure);

   // cmd=metadata, expects variable id
   std::ostream& metadata (std::ostream& os, cgicc::Cgicc const& cgi);

   // cmd=panos_near, expects variables lat and lon
   std::ostream& panosNear (std::ostream& os, cgicc::Cgicc const& cgi);

   // cmd=panos_in_range, expects variables lat1, lon1, lat2, lon2
   std::ostream& panosInRange (std::ostream& os, cgicc::Cgicc const& cgi);

   // cmd=pano_id_near, expects variables lat, lon, and pano_id
   std::ostream& panoIdNear (std::ostream& os, cgicc::Cgicc const& cgi);

   // cmd=download_pano, expects variable pano_id
   std::ostream& downloadPano (std::ostream& os, cgicc::Cgicc const& cgi);

   // cmd=new_tag, expects variables id, t1, p1, t2, p2
   std::ostream& newTag (std::ostream& os, cgicc::Cgicc const& cgi);

   // cmd=remove_tag, expects variables photo_id and tag_id
   std::ostream& removeTag (std::ostream& os, cgicc::Cgicc const& cgi);

   // cmd=save_database
   std::ostream& saveDatabase (std::ostream& os, cgicc::Cgicc const& cgi);

   // cmd=dump_database
   std::ostream& savePlaintext (std::ostream& os, cgicc::Cgicc const& cgi);

private:
   pugi::xml_node prepareDocument (pugi::xml_document& doc);
};

#endif // DATABASE_SERVER
