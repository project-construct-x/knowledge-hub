import { createBrowserRouter, Navigate } from "react-router-dom";
import AppContent from "./App";
import ProtectedRoute from "./components/ProtectedRoute";

import UseCaseList from "./pages/UseCaseList";
import UseCaseDetail from "./pages/UseCaseDetail";
import SubUseCaseList from "./pages/SubUseCaseList";
import SubUseCaseDetail from "./pages/SubUseCaseDetail";
import RoleList from "./pages/RoleList.tsx";
import RoleDetail from "./pages/RoleDetail.tsx";
import StandardList from "./pages/StandardList.tsx";
import StandardDetail from "./pages/StandardDetail.tsx";
import TransactionList from "./pages/TransactionList.tsx";
import TransactionDetail from "./pages/TransactionDetail.tsx";
import PropertyList from "./pages/PropertyList.tsx";
import PropertyDetail from "./pages/PropertyDetail.tsx";
import PropertyGroupList from "./pages/PropertyGroupList.tsx";
import PropertyGroupDetail from "./pages/PropertyGroupDetail.tsx";
import ClassList from "./pages/ClassList.tsx";
import ClassDetail from "./pages/ClassDetail.tsx";
import UserManagement from "./pages/UserManagement.tsx";
import OntologyGraph from "./pages/OntologyGraph.tsx";
import TurtleViewer from "./pages/TurtleViewer";


export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppContent />,
    children: [
      { index: true, element: <Navigate to="/usecases" replace /> },

      {
        path: "usecases",
        element: (
          <ProtectedRoute>
            <UseCaseList />
          </ProtectedRoute>
        ),
      },
      {
        path: "usecases/:id",
        element: (
          <ProtectedRoute>
            <UseCaseDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "subusecases",
        element: (
          <ProtectedRoute>
            <SubUseCaseList />
          </ProtectedRoute>
        ),
      },
      {
        path: "subusecases/:id",
        element: (
          <ProtectedRoute>
            <SubUseCaseDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "roles/",
        element: (
          <ProtectedRoute>
            <RoleList />
          </ProtectedRoute>
        ),
      },
      {
        path: "roles/:id",
        element: (
          <ProtectedRoute>
            <RoleDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "standards/",
        element: (
          <ProtectedRoute>
            <StandardList />
          </ProtectedRoute>
        ),
      },
      {
        path: "standards/:id",
        element: (
          <ProtectedRoute>
            <StandardDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "transactions/",
        element: (
          <ProtectedRoute>
            <TransactionList />
          </ProtectedRoute>
        ),
      },
      {
        path: "transactions/:id",
        element: (
          <ProtectedRoute>
            <TransactionDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "propertygroups/",
        element: (
          <ProtectedRoute>
            <PropertyGroupList />
          </ProtectedRoute>
        ),
      },
      {
        path: "propertygroups/:uuid",
        element: (
          <ProtectedRoute>
            <PropertyGroupDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "classes/",
        element: (
          <ProtectedRoute>
            <ClassList />
          </ProtectedRoute>
        ),
      },
      {
        path: "classes/:uuid",
        element: (
          <ProtectedRoute>
            <ClassDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "properties/",
        element: (
          <ProtectedRoute>
            <PropertyList />
          </ProtectedRoute>
        ),
      },
      {
        path: "properties/:uuid",
        element: (
          <ProtectedRoute>
            <PropertyDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "ontology",
        element: (
          <ProtectedRoute>
            <OntologyGraph />
          </ProtectedRoute>
        ),
      },
      {
        path: "turtle-viewer",
        element: (
          <ProtectedRoute>
            <TurtleViewer />
          </ProtectedRoute>
        ),
      },


      // Admin Routes
      {
        path: "users",
        element: (
          <ProtectedRoute>
            <UserManagement />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);